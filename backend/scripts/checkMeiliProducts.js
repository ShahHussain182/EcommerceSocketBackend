import 'dotenv/config';
import { MeiliSearch } from 'meilisearch';
import { logger } from '../Utils/logger.js';

async function checkMeiliProducts() {
  try {
    logger.info('Connecting to Meilisearch...');
    const meiliClient = new MeiliSearch({
      host: process.env.MEILI_HOST || 'http://127.0.0.1:7700',
      apiKey: process.env.MEILI_MASTER_KEY || '',
    });
    const productIndex = meiliClient.index('products');
    logger.info('✅ Connected to Meilisearch and got "products" index.');

    logger.info('Fetching up to 5 products from Meilisearch index...');
    const { results } = await productIndex.getDocuments({ limit: 5 });

    if (results.length === 0) {
      logger.warn('⚠️ No products found in Meilisearch index "products".');
    } else {
      logger.info(`✅ Found ${results.length} products in Meilisearch. Here are the first few:`);
      results.forEach((product, index) => {
        logger.info(`--- Product ${index + 1} ---`);
        logger.info(`ID: ${product._id}`);
        logger.info(`Name: ${product.name}`);
        logger.info(`Category: ${product.category}`);
        logger.info(`Image Processing Status: ${product.imageProcessingStatus}`);
        logger.info(`Is Featured: ${product.isFeatured}`);
        logger.info(`Price: ${product.price}`);
        logger.info(`Colors: ${product.colors?.join(', ')}`);
        logger.info(`Sizes: ${product.sizes?.join(', ')}`);
        logger.info(`Average Rating: ${product.averageRating}`);
        logger.info(`Number of Reviews: ${product.numberOfReviews}`);
        logger.info(`Image URLs (first): ${product.imageUrls?.[0]}`);
        logger.info(`Redentions URLs (first): ${product.imageRenditions}`);
     
        logger.info('--------------------');
      });
    }

  } catch (err) {
    logger.error('❌ Error checking Meilisearch products:', err);
    process.exit(1);
  }
}

checkMeiliProducts();