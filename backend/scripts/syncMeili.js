import 'dotenv/config';
import mongoose from 'mongoose';
import { MeiliSearch } from 'meilisearch';
import { Product } from '../Models/Product.model.js';

// 1. Connect to MongoDB
await mongoose.connect(process.env.MONGO_URL);

// 2. Setup Meilisearch client
const meiliClient = new MeiliSearch({
  host: process.env.MEILI_HOST || 'http://127.0.0.1:7700',
  apiKey: process.env.MEILI_MASTER_KEY || '',
});


await meiliClient.deleteIndexIfExists('products'); 
const productsIndex =  meiliClient.index('products');
async function syncProducts() {
  try {
    // ✅ Configure index before syncing
    await productsIndex.updateSettings({
      searchableAttributes: ['name', 'description', 'category'],
      filterableAttributes: ['category', 'price', 'colors', 'sizes', 'isFeatured', 'averageRating', 'numberOfReviews', 'imageProcessingStatus'],
      sortableAttributes: ['price', 'name', 'averageRating', 'numberOfReviews', 'createdAt'],
      displayedAttributes: [ // Ensure imageRenditions is included here
        '_id', 'name', 'description', 'category', 'imageUrls', 'imageRenditions',
        'imageProcessingStatus', 'isFeatured', 'variants', 'averageRating', 'numberOfReviews',
        'price', 'colors', 'sizes', 'createdAt', 'updatedAt'
      ],
      rankingRules: [
        'words',
        'typo',
        'proximity',
        'attribute',
        'sort',
        'exactness',
        'isFeatured:desc',
        'averageRating:desc',
        'numberOfReviews:desc',
      ],
      synonyms: {
        'phone': ['smartphone', 'mobile'],
        'tv': ['television'],
        'laptop': ['notebook', 'computer'],
        'shirt': ['t-shirt', 'tee'],
      },
      stopWords: ['a', 'an', 'the', 'is', 'are', 'and', 'or', 'for', 'with'],
      typoTolerance: {
        enabled: true,
        minWordSizeForTypos: {
          oneTypo: 3,
          twoTypos: 7,
        },
      
        disableOnAttributes: ['_id'],
      },
    });

    // 3. Get all products from MongoDB
    const products = await Product.find().lean();

    if (products.length === 0) {
      console.log('⚠️ No products found in MongoDB.');
      return;
    }

    // ⚡ Clean & flatten MongoDB docs for Meilisearch
    const docs = products.map((p) => ({
      _id: p._id.toString(),
      name: String(p.name ?? ''),
      description: String(p.description ?? ''),
      category: String(p.category ?? ''),
      imageUrls: p.imageUrls || [], 
      imageRenditions: p.imageRenditions || [], // Include imageRenditions here
      isFeatured: Boolean(p.isFeatured),
      variants: (p.variants || []).map(v => ({
        _id: v._id.toString(),
        size: String(v.size ?? ''),
        color: String(v.color ?? ''),
        price: Number(v.price ?? 0),
        stock: Number(v.stock ?? 0),
      })),
      price: Number(p.variants?.[0]?.price ?? 0), 
      colors: (p.variants || []).map(v => v.color).filter(Boolean),
      sizes: (p.variants || []).map(v => v.size).filter(Boolean),
      averageRating: Number(p.averageRating ?? 0),
      numberOfReviews: Number(p.numberOfReviews ?? 0),
      createdAt: p.createdAt ? new Date(p.createdAt).toISOString() : (new Date()).toISOString(),
      imageProcessingStatus: String(p.imageProcessingStatus ?? 'pending'),
    }));

    // 4. Push into Meilisearch
    const task = await productsIndex.addDocuments(docs);
    console.log(`📦 Sent ${docs.length} products to Meilisearch. Task UID: ${task.taskUid}`);

    // ✅ Wait for completion + log errors if any
    const status = await meiliClient.tasks.getTask(task.taskUid);
    if (status.status === 'failed') {
      console.error('❌ Sync failed:', status.error);
    } else {
      console.log('✅ Sync completed:', status.status);
    }
  } catch (err) {
    console.error('❌ Error syncing products:', err.message);
  } finally {
    await mongoose.disconnect();
  }
}

syncProducts();