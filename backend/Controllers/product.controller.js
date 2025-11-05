import { Product } from '../Models/Product.model.js';
import catchErrors from '../Utils/catchErrors.js';
import mongoose from 'mongoose';
import { createProductSchema, updateProductSchema } from '../Schemas/productSchema.js';
import { productIndex } from '../Utils/meilisearchClient.js';
import { uploadFileToS3 } from '../Utils/s3Upload.js';
import {logger} from '../Utils/logger.js';
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import s3Client from "../Utils/s3Client.js";
import { imageProcessingQueue } from '../Queues/imageProcessing.queue.js'; // Import the queue
import { v4 as uuidv4 } from 'uuid'; 

const S3_BUCKET_NAME = process.env.MINIO_BUCKET_NAME || "e-store-images";
const MINIO_URL = process.env.MINIO_URL || "http://localhost:9000";
const MAX_IMAGES = 5;

/**
 * @description Get all products with advanced filtering, sorting, and pagination using Meilisearch.
 */
export const getProducts = catchErrors(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 12;

  const { searchTerm, categories, priceRange, colors, sizes, sortBy } = req.query;

  // Build Meilisearch filter string
  const filters = [];

 // Admin/client can request to include pending/failed images (useful for admin UI)
  // Pass ?includeProcessing=true from the client to disable the "completed" filter.
  const includeProcessing = req.query.includeProcessing === 'true' || req.query.includeProcessing === true;

  // Only add the "completed" filter when NOT explicitly requesting to include processing states.
  if (!includeProcessing) {
    filters.push(`imageProcessingStatus = "completed"`);
  }
  if (categories) {
    const categoryArray = categories.split(',');
    filters.push(`category IN [${categoryArray.map(c => `"${c}"`).join(', ')}]`);
  }

  if (priceRange) {
    const [min, max] = priceRange.split(',').map(Number);
    if (!isNaN(min) && !isNaN(max)) {
      filters.push(`price >= ${min} AND price <= ${max}`);
    }
  }

  if (colors) {
    const colorArray = colors.split(',');
    filters.push(`colors IN [${colorArray.map(c => `"${c}"`).join(', ')}]`);
  }

  if (sizes) {
    const sizeArray = sizes.split(',');
    filters.push(`sizes IN [${sizeArray.map(s => `"${s}"`).join(', ')}]`);
  }

  // Sorting mapping
  let sort = [];
  switch (sortBy) {
    case 'price-desc':
      sort = ['price:desc'];
      break;
    case 'createdAt-desc':
      sort = ['createdAt:desc'];
      break;
    case 'name-asc':
      sort = ['name:asc'];
      break;
    case 'name-desc':
      sort = ['name:desc'];
      break;
    case 'averageRating-desc':
      sort = ['averageRating:desc'];
      break;
    case 'numberOfReviews-desc':
      sort = ['numberOfReviews:desc'];
      break;
    case 'relevance-desc':
      // Relevance is default in Meilisearch when query is present, no explicit sort needed
      break;
    case 'price-asc':
    default:
      sort = ['price:asc'];
      break;
  }

  const searchParams = {
    q: searchTerm || '',
    limit,
    offset: (page - 1) * limit,
    filter: filters.length > 0 ? filters.join(' AND ') : undefined,
    sort: sort.length > 0 ? sort : undefined,
    attributesToRetrieve: [ // Ensure imageRenditions is included here
      '_id', 'name', 'description', 'category', 'imageUrls', 'imageRenditions',
      'imageProcessingStatus', 'isFeatured', 'variants', 'averageRating', 'numberOfReviews',
      'price', 'colors', 'sizes', 'createdAt', 'updatedAt'
    ],
  };

  const results = await productIndex.search(searchParams.q, searchParams);

  res.status(200).json({
    success: true,
    products: results.hits,
    totalProducts: results.estimatedTotalHits,
    nextPage: results.estimatedTotalHits > page * limit ? page + 1 : null,
  });
});

/**
 * @description Get autocomplete suggestions using Meilisearch.
 */
export const getAutocompleteSuggestions = catchErrors(async (req, res) => {
  const { query } = req.query;

  if (!query || query.length < 2) {
    return res.status(200).json({ success: true, suggestions: [] });
  }

  const results = await productIndex.search(query, {
    limit: 5,
    attributesToRetrieve: ['name'],
    filter: 'imageProcessingStatus = "completed"', // Only suggest processed products
  });

  res.status(200).json({
    success: true,
    suggestions: results.hits.map((hit) => hit.name),
  });
});

/**
 * @description Get a single product by its ID (MongoDB source of truth).
 */
export const getProductById = catchErrors(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'Invalid product ID format.' });
  }

  const product = await Product.findById(id);

  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found.' });
  }

  res.status(200).json({ success: true, product });
});

/**
 * @description Get featured products (from MongoDB).
 */
export const getFeaturedProducts = catchErrors(async (req, res) => {
  const products = await Product.find({ isFeatured: true, imageProcessingStatus: 'completed' }).limit(4);
  res.status(200).json({ success: true, products });
});

/**
 * @description Create a new product (Admin only) — also index in Meilisearch.
 */
export const createProduct = catchErrors(async (req, res) => {
  logger.debug(`[createProduct] Raw req.body: ${JSON.stringify(req.body)}`);
  logger.debug(`[createProduct] Raw req.files: ${JSON.stringify(req.files?.map(f => f.originalname))}`);

  const parsedBody = {
    ...req.body,
    isFeatured: req.body.isFeatured === 'true',
    variants: req.body.variants ? JSON.parse(req.body.variants) : undefined,
  };
  logger.debug(`[createProduct] Parsed body before Zod: ${JSON.stringify(parsedBody)}`);

  const uploadedOriginalImageUrls = [];
  const originalS3Keys = [];

  if (req.files && req.files.length > 0) {
    if (req.files.length > MAX_IMAGES) {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot upload more than ${MAX_IMAGES} images. You are trying to add ${req.files.length}.` 
      });
    }
    for (const file of req.files) {
      try {
        const s3Key = `products/originals/${new mongoose.Types.ObjectId()}-${Date.now()}.${file.mimetype.split('/')[1]}`;
        const url = await uploadFileToS3(file.buffer, file.mimetype, s3Key); 
        uploadedOriginalImageUrls.push(url);
        originalS3Keys.push(s3Key);
      } catch (error) {
        logger.error(`Failed to upload file ${file.originalname} during product creation: ${error.message}`);
        return res.status(500).json({ success: false, message: `Failed to upload image: ${error.message}` });
      }
    }
  } else {
    return res.status(400).json({ success: false, message: 'At least one image is required.' });
  }

  const productDataForValidation = {
    ...parsedBody,
    imageUrls: uploadedOriginalImageUrls, // Store original URLs initially
    // Removed imageProcessingStatus from here, as it's handled by Mongoose default
  };

  const productData = createProductSchema.parse(productDataForValidation);

  if (!productData.variants || productData.variants.length === 0) {
    productData.variants = [{
      size: "N/A",
      color: "N/A",
      price: 0,
      stock: 0,
    }];
  }

  const product = await Product.create(productData); // Mongoose default will set imageProcessingStatus to 'pending'

  // Add jobs to the image processing queue
  for (let i = 0; i < uploadedOriginalImageUrls.length; i++) {
    await imageProcessingQueue.add(
      `process-image-${product._id}-${i}`,
      {
        productId: product._id.toString(),
        originalS3Key: originalS3Keys[i],
        imageIndex: i,
      }
    );
  }

  // Sync with Meilisearch (initial entry, will be updated by worker)
  await productIndex.addDocuments([{
    _id: product._id.toString(),
    name: product.name,
    description: product.description,
    category: product.category,
    imageUrls: product.imageUrls || [],
    imageRenditions: product.imageRenditions || [], // Include imageRenditions here
    imageProcessingStatus: product.imageProcessingStatus, // Include status
    isFeatured: Boolean(product.isFeatured),
    variants: (product.variants || []).map(v => ({
      _id: v._id.toString(),
      size: String(v.size ?? ''),
      color: String(v.color ?? ''),
      price: Number(v.price ?? 0),
      stock: Number(v.stock ?? 0),
    })),
    price: product.variants[0]?.price ?? 0,
    colors: product.variants.map(v => v.color),
    sizes: product.variants.map(v => v.size),
    averageRating: product.averageRating ?? 0,
    numberOfReviews: product.numberOfReviews ?? 0,
    createdAt: product.createdAt ? new Date(product.createdAt).toISOString() :  (new Date()).toISOString(),
  }]);
  

  res.status(201).json({ success: true, message: 'Product created successfully! Images are being processed.', product });
});

/**
 * @description Update an existing product (Admin only) — also update Meilisearch.
 */
export const updateProduct = catchErrors(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'Invalid product ID format.' });
  }

  const updates = updateProductSchema.parse(req.body);

  if (updates.variants && updates.variants.length === 0) {
    updates.variants = [{
      size: "N/A",
      color: "N/A",
      price: 0,
      stock: 0,
    }];
  }

  const product = await Product.findByIdAndUpdate(id, updates, {
    new: true,
    runValidators: true,
  });

  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found.' });
  }

  // Sync update with Meilisearch
  await productIndex.addDocuments([{
    _id: product._id.toString(),
    name: product.name,
    description: product.description,
    category: product.category,
    imageUrls: product.imageUrls || [],
    imageRenditions: product.imageRenditions || [], // Include imageRenditions here
    imageProcessingStatus: product.imageProcessingStatus, // Include status
    isFeatured: Boolean(product.isFeatured),
    variants: (product.variants || []).map(v => ({
      _id: v._id.toString(),
      size: String(v.size ?? ''),
      color: String(v.color ?? ''),
      price: Number(v.price ?? 0),
      stock: Number(v.stock ?? 0),
    })),
    price: product.variants[0]?.price ?? 0,
    colors: product.variants.map(v => v.color),
    sizes: product.variants.map(v => v.size),
    averageRating: product.averageRating ?? 0,
    numberOfReviews: product.numberOfReviews ?? 0,
    createdAt: product.createdAt ? new Date(product.createdAt).toISOString() :  (new Date()).toISOString(),
  }]);
  

  res.status(200).json({ success: true, message: 'Product updated successfully!', product });
});

/**
 * @description Delete a product (Admin only) — also delete from Meilisearch.
 */
export const deleteProduct = catchErrors(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'Invalid product ID format.' });
  }

  const product = await Product.findByIdAndDelete(id);

  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found.' });
  }

  // Delete all associated image renditions from S3
  if (product.imageRenditions && product.imageRenditions.length > 0) {
    const deletePromises = product.imageRenditions.flatMap(renditionSet => {
      const keysToDelete = [];
      if (renditionSet.original) keysToDelete.push(renditionSet.original.replace(`${MINIO_URL}/${S3_BUCKET_NAME}/`, ''));
      if (renditionSet.medium) keysToDelete.push(renditionSet.medium.replace(`${MINIO_URL}/${S3_BUCKET_NAME}/`, ''));
      if (renditionSet.thumbnail) keysToDelete.push(renditionSet.thumbnail.replace(`${MINIO_URL}/${S3_BUCKET_NAME}/`, ''));
      if (renditionSet.webp) keysToDelete.push(renditionSet.webp.replace(`${MINIO_URL}/${S3_BUCKET_NAME}/`, ''));
      if (renditionSet.avif) keysToDelete.push(renditionSet.avif.replace(`${MINIO_URL}/${S3_BUCKET_NAME}/`, ''));
      
      return keysToDelete.map(async (s3Key) => {
        try {
          await s3Client.send(new DeleteObjectCommand({ Bucket: S3_BUCKET_NAME, Key: s3Key }));
          logger.info(`Deleted S3 object: ${s3Key}`);
        } catch (s3Error) {
          logger.error(`Failed to delete S3 object ${s3Key}:`, { error: s3Error });
        }
      });
    });
    await Promise.all(deletePromises);
  }

  await productIndex.deleteDocument(id.toString());

  res.status(200).json({ success: true, message: 'Product deleted successfully!' });
});

/**
 * @description Upload product images to S3 and update the product document.
 */


export const uploadProductImages = catchErrors(async (req, res) => {
  const { id } = req.params;
  const PLACEHOLDER_MARKER = 'placeholder.svg'; // adjust if yours differs

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'Invalid product ID format.' });
  }
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ success: false, message: 'No files uploaded.' });
  }

  logger.info(`[uploadProductImages] Received ${req.files.length} file(s) for product ${id}`);

  const product = await Product.findById(id);
  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found.' });
  }

  // Ensure arrays exist
  product.imageUrls = Array.isArray(product.imageUrls) ? product.imageUrls : [];
  product.imageRenditions = Array.isArray(product.imageRenditions) ? product.imageRenditions : [];

  // Find indexes that look like placeholders (by originalS3Key or original URL)
  const placeholderIndexes = [];
  for (let i = 0; i < product.imageRenditions.length; i++) {
    const r = product.imageRenditions[i] || {};
    const orig = r.original || product.imageUrls[i] || '';
    const key = r.originalS3Key || '';
    if ((typeof orig === 'string' && orig.includes(PLACEHOLDER_MARKER)) ||
        (typeof key === 'string' && key.includes(PLACEHOLDER_MARKER))) {
      placeholderIndexes.push(i);
    }
  }

  // Upload all files to S3 first
  const uploaded = []; // { url, s3Key, uploadId, originalName }
  for (const file of req.files) {
    try {
      const s3Key = `products/originals/${new mongoose.Types.ObjectId()}-${Date.now()}.${file.mimetype.split('/')[1]}`;
      const url = await uploadFileToS3(file.buffer, file.mimetype, s3Key);
      const uploadId = uuidv4();
      uploaded.push({ url, s3Key, uploadId, originalName: file.originalname });
      logger.info(`[uploadProductImages] Uploaded file ${file.originalname} -> s3Key=${s3Key} uploadId=${uploadId}`);
    } catch (err) {
      logger.error(`[uploadProductImages] Failed to upload ${file.originalname}: ${err?.message || err}`);
    }
  }

  if (uploaded.length === 0) {
    return res.status(500).json({ success: false, message: 'No images were successfully uploaded.' });
  }

  // Place uploads into placeholder slots first, else append
  const queuedJobs = [];
  for (let i = 0; i < uploaded.length; i++) {
    const { url, s3Key, uploadId } = uploaded[i];

    if (placeholderIndexes.length > 0) {
      const targetIndex = placeholderIndexes.shift(); // fill this placeholder slot
      // Ensure arrays long enough
      while (product.imageRenditions.length <= targetIndex) {
        product.imageRenditions.push({ original: null, medium: null, thumbnail: null, webp: null, avif: null, uploadId: null, originalS3Key: null });
      }
      while (product.imageUrls.length <= targetIndex) product.imageUrls.push(null);

      // Put the uploaded original URL into both arrays; worker will replace with processed renditions
      product.imageUrls[targetIndex] = url;
      product.imageRenditions[targetIndex] = {
        original: url,
        medium: url,
        thumbnail: url,
        webp: null,
        avif: null,
        uploadId,
        originalS3Key: s3Key,
      };

      queuedJobs.push({ productId: product._id.toString(), originalS3Key: s3Key, imageIndex: targetIndex, uploadId });
      logger.info(`[uploadProductImages] Replaced placeholder at index=${targetIndex} with uploadId=${uploadId}`);
    } else {
      // Append to end
      const newIndex = product.imageUrls.length;
      product.imageUrls.push(url);
      product.imageRenditions.push({
        original: url,
        medium: url,
        thumbnail: url,
        webp: null,
        avif: null,
        uploadId,
        originalS3Key: s3Key,
      });
      queuedJobs.push({ productId: product._id.toString(), originalS3Key: s3Key, imageIndex: newIndex, uploadId });
      logger.info(`[uploadProductImages] Appended uploaded image at index=${newIndex} uploadId=${uploadId}`);
    }
  }

  // IMPORTANT: remove any remaining placeholders so seeded placeholder(s) disappear entirely
  const filteredImageUrls = [];
  const filteredRenditions = [];
  for (let i = 0; i < product.imageUrls.length; i++) {
    const url = product.imageUrls[i];
    const rend = product.imageRenditions[i] || {};
    const orig = rend.original || url || '';
    const key = rend.originalS3Key || '';

    const isPlaceholder = (typeof orig === 'string' && orig.includes(PLACEHOLDER_MARKER)) ||
                          (typeof key === 'string' && key.includes(PLACEHOLDER_MARKER));

    // Keep only if not placeholder
    if (!isPlaceholder) {
      filteredImageUrls.push(url);
      filteredRenditions.push(rend);
    } else {
      logger.info(`[uploadProductImages] Removing leftover placeholder at index ${i} for product ${product._id}`);
    }
  }

  // If filtered arrays are empty (shouldn't be — because we uploaded), but guard:
  if (filteredImageUrls.length === 0 && uploaded.length > 0) {
    // keep the uploaded ones (they were already placed above); reconstruct from current product arrays
    product.imageUrls = product.imageUrls.filter(u => typeof u === 'string' && !u.includes(PLACEHOLDER_MARKER));
    product.imageRenditions = product.imageRenditions.filter(r => !(r?.original && String(r.original).includes(PLACEHOLDER_MARKER)));
  } else {
    product.imageUrls = filteredImageUrls;
    product.imageRenditions = filteredRenditions;
  }

  // Ensure at least one image remains (Mongoose validation)
  if (!product.imageUrls || product.imageUrls.length === 0) {
    // fallback: keep first uploaded (should never happen, defensive)
    const first = uploaded[0];
    product.imageUrls = [first.url];
    product.imageRenditions = [{
      original: first.url,
      medium: first.url,
      thumbnail: first.url,
      webp: null,
      avif: null,
      uploadId: first.uploadId,
      originalS3Key: first.s3Key,
    }];
  }

  product.imageProcessingStatus = 'pending';
  await product.save();

  // Add jobs to queue (after product.save to ensure product exists)
  for (const job of queuedJobs) {
    await imageProcessingQueue.add(`process-image-${job.productId}-${job.uploadId}`, {
      productId: job.productId,
      originalS3Key: job.originalS3Key,
      imageIndex: job.imageIndex,
      uploadId: job.uploadId,
    });
    logger.info(`[uploadProductImages] Queued job process-image-${job.productId}-${job.uploadId} for index=${job.imageIndex}`);
  }

  // Update Meilisearch (initial entry)
  await productIndex.addDocuments([{
    _id: product._id.toString(),
    name: product.name,
    description: product.description,
    category: product.category,
    imageUrls: product.imageUrls,
    imageRenditions: product.imageRenditions,
    imageProcessingStatus: product.imageProcessingStatus,
    isFeatured: Boolean(product.isFeatured),
    variants: (product.variants || []).map(v => ({
      _id: v._id.toString(),
      size: String(v.size ?? ''),
      color: String(v.color ?? ''),
      price: Number(v.price ?? 0),
      stock: Number(v.stock ?? 0),
    })),
    price: product.variants[0]?.price ?? 0,
    colors: product.variants.map(v => v.color),
    sizes: product.variants.map(v => v.size),
    averageRating: product.averageRating ?? 0,
    numberOfReviews: product.numberOfReviews ?? 0,
    createdAt: product.createdAt ? new Date(product.createdAt).toISOString() : null,
  }]);

  res.status(200).json({
    success: true,
    message: `${uploaded.length} image(s) uploaded. Placeholder(s) removed; processing in background.`,
    product,
  });
});



/**
 * @description Delete a specific product image from S3 and update the product document.
 */
export const deleteProductImage = catchErrors(async (req, res) => {
  const { id } = req.params;
  const { imageUrl } = req.query; // This is the URL of the *main* image (e.g., medium.webp)

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'Invalid product ID format.' });
  }
  if (!imageUrl) {
    return res.status(400).json({ success: false, message: 'Image URL is required.' });
  }

  const product = await Product.findById(id);
  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found.' });
  }

  const imageIndex = product.imageUrls.indexOf(imageUrl);
  if (imageIndex === -1) {
    return res.status(404).json({ success: false, message: 'Image not found in product\'s main image list.' });
  }

  if (product.imageUrls.length <= 1) {
    return res.status(400).json({ success: false, message: 'A product must have at least one image.' });
  }

  
 

  // Delete all renditions from S3
   // Get the renditions associated with this image
   const renditionsToDelete = product.imageRenditions[imageIndex];

   // Delete all renditions from S3 -- robust and defensive
   if (renditionsToDelete) {
     const keysToDeleteSet = new Set();
 
     // Helper: derive S3 key from a URL or return null
     const deriveKey = (val) => {
       if (!val) return null;
       if (typeof val !== 'string') return null;
 
       // If it's already an s3/minio key like 'products/...' (no host), accept it
       if (!val.startsWith('http') && val.includes('/')) {
         // Heuristic: if it looks like 'products/...' or contains bucket path, treat as key
         return val;
       }
 
       // If it's a full URL that includes MINIO_URL and BUCKET, strip prefix
       const prefix = `${MINIO_URL}/${S3_BUCKET_NAME}/`;
       if (val.startsWith(prefix)) {
         return val.replace(prefix, '');
       }
 
       // If it's a full URL but not matching MINIO_URL, try to parse path and find last segments
       try {
         const u = new URL(val);
         const parts = u.pathname.split('/').filter(Boolean);
         // if path contains bucket name, remove until bucket name
         const bucketIndex = parts.indexOf(S3_BUCKET_NAME);
         if (bucketIndex >= 0 && parts.length > bucketIndex + 1) {
           return parts.slice(bucketIndex + 1).join('/');
         }
         // fallback: return last two segments (best-effort)
         if (parts.length >= 2) return parts.slice(-2).join('/');
       } catch (e) {
         // not a valid URL
       }
 
       // otherwise can't derive
       return null;
     };
 
     // Known rendition fields we care about (skip uploadId)
     const candidateFields = ['original', 'medium', 'thumbnail', 'webp', 'avif', 'originalS3Key'];
 
     for (const field of candidateFields) {
       const val = renditionsToDelete[field];
       const derived = deriveKey(val);
       if (derived) {
         keysToDeleteSet.add(derived);
         logger.info(`[deleteProductImage] Found S3 key candidate from field ${field}: ${derived}`);
       } else if (val) {
         logger.debug(`[deleteProductImage] Skipping non-S3 value at field ${field}: ${String(val).slice(0,200)}`);
       }
     }
 
     const keysToDelete = Array.from(keysToDeleteSet);
     if (keysToDelete.length === 0) {
       logger.info(`[deleteProductImage] No S3 keys found to delete for product ${id} index ${imageIndex}`);
     } else {
       logger.info(`[deleteProductImage] Will attempt to delete ${keysToDelete.length} S3 object(s): ${JSON.stringify(keysToDelete)}`);
       const deletePromises = keysToDelete.map((s3Key) =>
         s3Client.send(new DeleteObjectCommand({ Bucket: S3_BUCKET_NAME, Key: s3Key }))
           .then(() => logger.info(`[deleteProductImage] Deleted S3 object: ${s3Key}`))
           .catch(s3Error => logger.error(`[deleteProductImage] Failed to delete S3 object ${s3Key}: ${s3Error?.message || s3Error}`, { error: s3Error }))
       );
       await Promise.all(deletePromises);
     }
   }
  

  // Remove image URL and renditions from product document
  product.imageUrls.splice(imageIndex, 1);
  product.imageRenditions.splice(imageIndex, 1);
  
  // If there are no more images, set status to pending (or handle as error)
  if (product.imageUrls.length === 0) {
    product.imageProcessingStatus = 'pending'; // Or 'failed' depending on desired behavior
  } else {
    // Re-evaluate processing status if needed, e.g., if all remaining are completed
    const allRemainingCompleted = product.imageRenditions.every(r => r.medium);
    if (allRemainingCompleted) {
      product.imageProcessingStatus = 'completed';
    } else {
      product.imageProcessingStatus = 'pending';
    }
  }

  await product.save();

  // Update Meilisearch
  await productIndex.addDocuments([{
    _id: product._id.toString(),
    name: product.name,
    description: product.description,
    category: product.category,
    imageUrls: product.imageUrls,
    imageRenditions: product.imageRenditions, // Include imageRenditions here
    imageProcessingStatus: product.imageProcessingStatus,
    isFeatured: Boolean(product.isFeatured),
    variants: (product.variants || []).map(v => ({
      _id: v._id.toString(),
      size: String(v.size ?? ''),
      color: String(v.color ?? ''),
      price: Number(v.price ?? 0),
      stock: Number(v.stock ?? 0),
    })),
    price: product.variants[0]?.price ?? 0,
    colors: product.variants.map(v => v.color),
    sizes: product.variants.map(v => v.size),
    averageRating: product.averageRating ?? 0,
    numberOfReviews: product.numberOfReviews ?? 0,
    createdAt: product.createdAt ? new Date(product.createdAt).toISOString() : null,
  }]);

  res.status(200).json({
    success: true,
    message: 'Image deleted successfully.',
    product: product,
  });
});