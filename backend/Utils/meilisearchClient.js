// utils/meilisearchClient.js
import { MeiliSearch } from 'meilisearch';

export const meiliClient = new MeiliSearch({
  host: process.env.MEILI_HOST || 'http://127.0.0.1:7700',
  apiKey: process.env.MEILI_MASTER_KEY,
});
export const productIndex = meiliClient.index('products');