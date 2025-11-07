import { Worker } from 'bullmq';
import sharp from 'sharp';
import axios from 'axios';


import s3Client from '../Utils/s3Client.js';
import { GetObjectCommand, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { Product } from '../Models/Product.model.js';

import { productIndex } from '../Utils/meilisearchClient.js';

const S3_BUCKET_NAME = process.env.MINIO_BUCKET_NAME || "e-store-images";
const MINIO_URL = process.env.MINIO_URL || "http://localhost:9000";
const API_URL = process.env.INTERNAL_API_URL || 'http://localhost:3001';
const WORKER_SECRET = process.env.WORKER_SECRET || 'dev-worker-secret-change-me';
const internalApi = axios.create({
  baseURL: API_URL,
  timeout: 5000, // 5s
  headers: {
    'x-worker-secret': WORKER_SECRET,
    'Content-Type': 'application/json',
  },
});

// Helper to download file from S3
const downloadFileFromS3 = async (key) => {
  try {
    const command = new GetObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: key,
    });
    const response = await s3Client.send(command);
    // For AWS SDK v3 in Node, response.Body may be a stream - use transformToByteArray if available
    if (typeof response.Body?.transformToByteArray === 'function') {
      return response.Body.transformToByteArray();
    }
    // fallback: collect stream into buffer
    const chunks = [];
    for await (const chunk of response.Body) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  } catch (error) {
    console.error(`[ImageWorker] Failed to download ${key} from S3: ${error?.message || error}`);
    throw error;
  }
};

// Helper to upload file to S3 (returns public URL)
const uploadFileToS3 = async (buffer, key, contentType) => {
  try {
    const command = new PutObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    });
    await s3Client.send(command);
    return `${MINIO_URL}/${S3_BUCKET_NAME}/${key}`;
  } catch (error) {
    console.error(`[ImageWorker] Failed to upload ${key} to S3: ${error?.message || error}`);
    throw error;
  }
};

// Helper to check object existence using HeadObjectCommand (returns true if exists)
const checkObjectExists = async (key) => {
  try {
    await s3Client.send(new HeadObjectCommand({ Bucket: S3_BUCKET_NAME, Key: key }));
    return true;
  } catch (err) {
    return false;
  }
};
export function createImageProcessingWorker(connection) {
 const imageProcessingWorker = new Worker(
  'image-processing',
  async (job) => {
    const { productId, originalS3Key, imageIndex, uploadId } = job.data;
    console.log(`[ImageWorker] Job started: product=${productId} imageIndex=${imageIndex} uploadId=${uploadId} key=${originalS3Key}`);

    // Load product
    let product;
    try {
      product = await Product.findById(productId);
      if (!product) {
        throw new Error(`Product with ID ${productId} not found.`);
      }
    } catch (err) {
      console.error(`[ImageWorker] Could not load product ${productId}: ${err?.message || err}`);
      throw err;
    }

    console.log(`[ImageWorker] Product ${productId} before processing: imageUrls=${(product.imageUrls || []).length} imageRenditions=${(product.imageRenditions || []).length}`);

    try {
      // download original
      const originalImageBuffer = await downloadFileFromS3(originalS3Key);
      const baseFileName = originalS3Key.split('/').pop().split('.')[0];

      const renditions = {};
      const uploadPromises = [];

      // sizes and formats
      const sizes = {
        original: null,
        medium: 800,
        thumbnail: 200,
      };
      const formats = ['webp', 'avif'];

      // For each size and format produce buffer and upload
      for (const sizeName of Object.keys(sizes)) {
        const width = sizes[sizeName];
        let processor = sharp(originalImageBuffer);
        if (width) {
          processor = processor.resize(width, width, { fit: 'inside', withoutEnlargement: true });
        }

        for (const formatName of formats) {
          // create fresh pipeline for each iteration to avoid reusing stream
          const buf = await processor.clone().toFormat(formatName).toBuffer();
          const key = `products/${productId}/${baseFileName}-${sizeName}.${formatName}`;
          uploadPromises.push(
            uploadFileToS3(buf, key, `image/${formatName}`).then(url => {
              renditions[`${sizeName}_${formatName}`] = url;
              // primary picks
              if (sizeName === 'original' && formatName === 'webp') renditions.original = url;
              if (sizeName === 'medium' && formatName === 'webp') renditions.medium = url;
              if (sizeName === 'thumbnail' && formatName === 'webp') renditions.thumbnail = url;
            })
          );
        }
      }

      await Promise.all(uploadPromises);

      console.log(`[ImageWorker] Renditions generated for product ${productId}: ${JSON.stringify(Object.keys(renditions))}`);
      console.log(`[ImageWorker] Renditions detail: ${JSON.stringify(renditions, null, 2)}`);

      // Re-fetch product fresh before updating to get the latest arrays
      product = await Product.findById(productId);
      if (!product) throw new Error(`Product ${productId} disappeared before update.`);

      product.imageUrls = product.imageUrls || [];
      product.imageRenditions = product.imageRenditions || [];

      // Determine targetIndex: prefer uploadId
      let targetIndex = -1;
      if (uploadId) {
        targetIndex = (product.imageRenditions || []).findIndex(r => r && r.uploadId === uploadId);
        console.log(`[ImageWorker] lookup by uploadId=${uploadId} returned index=${targetIndex}`);
      }

      // If not found by uploadId, try imageIndex fallback
      if (targetIndex === -1 && typeof imageIndex === 'number' && imageIndex >= 0) {
        if ((product.imageRenditions || []).length > imageIndex) {
          targetIndex = imageIndex;
          console.log(`[ImageWorker] uploadId not found, falling back to provided imageIndex=${imageIndex}`);
        } else {
          // pad imageRenditions up to imageIndex
          console.log(`[ImageWorker] imageRenditions too short (len=${product.imageRenditions.length}), padding up to index ${imageIndex}`);
          for (let i = product.imageRenditions.length; i <= imageIndex; i++) {
            product.imageRenditions.push({
              original: null,
              medium: null,
              thumbnail: null,
              webp: null,
              avif: null,
              uploadId: null,
              originalS3Key: null,
            });
          }
          targetIndex = imageIndex;
        }
      }

      // If still not found, append a new slot
      if (targetIndex === -1) {
        console.log(`[ImageWorker] Could not find a slot by uploadId or imageIndex; appending a new rendition slot for uploadId=${uploadId}`);
        product.imageRenditions.push({
          original: null,
          medium: null,
          thumbnail: null,
          webp: null,
          avif: null,
          uploadId: uploadId || null,
          originalS3Key: originalS3Key || null,
        });
        targetIndex = product.imageRenditions.length - 1;
      }

      // Build updated rendition object
      const updatedRendition = {
        original: renditions.original_webp || renditions.original || product.imageRenditions[targetIndex]?.original,
        medium: renditions.medium_webp || renditions.medium || product.imageRenditions[targetIndex]?.medium,
        thumbnail: renditions.thumbnail_webp || renditions.thumbnail || product.imageRenditions[targetIndex]?.thumbnail,
        webp: renditions.original_webp || product.imageRenditions[targetIndex]?.webp,
        avif: renditions.original_avif || product.imageRenditions[targetIndex]?.avif,
        uploadId: uploadId || product.imageRenditions[targetIndex]?.uploadId || null,
        originalS3Key: product.imageRenditions[targetIndex]?.originalS3Key || originalS3Key || null,
      };

      // Ensure imageUrls array length, pad if required
      if (!product.imageUrls) product.imageUrls = [];
      if (product.imageUrls.length <= targetIndex) {
        for (let i = product.imageUrls.length; i <= targetIndex; i++) {
          product.imageUrls.push(product.imageUrls[i] || null);
        }
      }

      // Write updates
      product.imageRenditions[targetIndex] = updatedRendition;
      product.imageUrls[targetIndex] = updatedRendition.medium || updatedRendition.original || product.imageUrls[targetIndex];

      // Re-evaluate processing status
      const allImagesProcessed = (product.imageRenditions || []).every(r => r && r.medium);
      product.imageProcessingStatus = allImagesProcessed ? 'completed' : 'pending';

      await product.save();
      console.log(`[ImageWorker] Product ${productId} updated at index=${targetIndex}. imageUrls.len=${product.imageUrls.length} imageRenditions.len=${product.imageRenditions.length}`);
      console.log(`[ImageWorker] Updated rendition at index ${targetIndex}: ${JSON.stringify(updatedRendition, null, 2)}`);
      // notify internal server to emit socket event (success/pending)
(async () => {
  try {
    await internalApi.post('/internal/notify-product', {
      productId,
      status: product.imageProcessingStatus, // 'completed' or 'pending'
      imageIndex: targetIndex,
      rendition: {
        medium: updatedRendition.medium,
        thumbnail: updatedRendition.thumbnail,
      },
    });
  } catch (notifyErr) {
    console.warn('[ImageWorker] notify endpoint call failed:', notifyErr?.message || notifyErr);
  }
})();
      // Update Meilisearch if completed
      if (product.imageProcessingStatus === 'completed') {
        await productIndex.updateDocuments([{
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
        console.log(`[ImageWorker] Product ${productId} Meilisearch document updated with status 'completed'.`);
      }

      // Verify processed rendition exists in S3 before deleting original
      try {
        const renditionUrlForCheck = updatedRendition.medium || updatedRendition.original;
        if (renditionUrlForCheck && renditionUrlForCheck.startsWith(`${MINIO_URL}/${S3_BUCKET_NAME}/`)) {
          const keyToCheck = renditionUrlForCheck.replace(`${MINIO_URL}/${S3_BUCKET_NAME}/`, '');
          console.log(`[ImageWorker] Verifying rendition exists at key=${keyToCheck} before deleting original=${originalS3Key}`);
          const exists = await checkObjectExists(keyToCheck);
          if (exists) {
            try {
              await s3Client.send(new DeleteObjectCommand({ Bucket: S3_BUCKET_NAME, Key: originalS3Key }));
              console.log(`[ImageWorker] Deleted original S3 object: ${originalS3Key}`);
            } catch (delErr) {
              console.log(`[ImageWorker] Failed to delete original S3 object ${originalS3Key}: ${delErr?.message || delErr}`);
            }
          } else {
            console.log(`[ImageWorker] Rendition not yet available at key=${keyToCheck}. Skipping delete of original ${originalS3Key}`);
          }
        } else {
          console.log(`[ImageWorker] Could not derive S3 key from rendition URL (${renditionUrlForCheck}). Skipping delete of original ${originalS3Key}`);
        }
      } catch (verifyErr) {
        console.log(`[ImageWorker] Verification step failed for product ${productId} index ${targetIndex}: ${verifyErr?.message || verifyErr}`);
      }

    } catch (error) {
      console.error(`[ImageWorker] Failed to process image for product ${productId} index ${imageIndex}: ${error?.message || error}`, { error });
      // mark product failed if possible
      try {
        product.imageProcessingStatus = 'failed';
        await product.save();
        await productIndex.updateDocuments([{ _id: product._id.toString(), imageProcessingStatus: 'failed' }]);
        // notify internal server that processing failed
(async () => {
  try {
    await internalApi.post('/internal/notify-product', {
      productId,
      status: 'failed',
      imageIndex: typeof targetIndex === 'number' ? targetIndex : null,
      error: String(error?.message || error),
    });
  } catch (notifyErr) {
    console.warn('[ImageWorker] notify (failed) call failed:', notifyErr?.message || notifyErr);
  }
})();
        console.log(`[ImageWorker] Product ${productId} Meilisearch document updated with status 'failed'.`);
      } catch (saveErr) {
        console.error(`[ImageWorker] Failed to set product ${productId} status to failed: ${saveErr?.message || saveErr}`);
      }
      throw error;
    }

  },
  { connection }
);

imageProcessingWorker.on('completed', (job) => {
  console.log(`[ImageWorker] Job ${job.id} completed for product ${job.data.productId}`);
});

imageProcessingWorker.on('failed', (job, err) => {
  console.error(`[ImageWorker] Job ${job.id} failed for product ${job.data.productId}: ${err?.message || err}`, { error: err });
});

console.log('[ImageWorker] Image processing worker started.');
return imageProcessingWorker;
}