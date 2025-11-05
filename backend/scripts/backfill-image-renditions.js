// backend/scripts/backfill-image-renditions-full.js
import mongoose from 'mongoose';
import { Product } from '../Models/Product.model.js'; // adjust path if different
import { config } from '../Utils/config.js';

const MONGO_URL = process.env.MONGO_URL || config.MONGO_URI || 'mongodb://localhost:27017/mydb';
const MINIO_URL = process.env.MINIO_URL || 'http://localhost:9000';
const S3_BUCKET = process.env.MINIO_BUCKET_NAME || 'e-store-images';

function deriveS3KeyFromUrl(url) {
  if (!url || typeof url !== 'string') return null;
  // If it's a MINIO/S3 URL like `${MINIO_URL}/${S3_BUCKET}/path/to/key`
  const prefix = `${MINIO_URL}/${S3_BUCKET}/`;
  if (url.startsWith(prefix)) {
    return url.replace(prefix, '');
  }
  // If it's an absolute URL that includes bucket name and path, try to extract last two segments
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts.length >= 2) {
      return parts.slice(-2).join('/');
    }
  } catch (e) {
    // not a valid URL, ignore
  }
  return null;
}

async function run() {
  console.log('Connecting to MongoDB at', MONGO_URL);
  await mongoose.connect(MONGO_URL, {});

  const cursor = Product.find().cursor();
  let updated = 0;
  let checked = 0;

  for await (const doc of cursor) {
    checked++;
    const imageUrls = Array.isArray(doc.imageUrls) ? doc.imageUrls : [];
    doc.imageRenditions = Array.isArray(doc.imageRenditions) ? doc.imageRenditions : [];

    let changed = false;

    // If renditions shorter than urls, pad
    if (doc.imageRenditions.length < imageUrls.length) {
      const missing = imageUrls.length - doc.imageRenditions.length;
      console.log(`Product ${doc._id}: padding ${missing} rendition(s) (urls=${imageUrls.length} renditions=${doc.imageRenditions.length})`);
      for (let i = doc.imageRenditions.length; i < imageUrls.length; i++) {
        const url = imageUrls[i] || '/placeholder.svg';
        doc.imageRenditions.push({
          original: url,
          medium: url,
          thumbnail: url,
          webp: null,
          avif: null,
          uploadId: null,
          originalS3Key: deriveS3KeyFromUrl(url),
        });
        changed = true;
      }
    }

    // If there are still zero imageRenditions but imageUrls exist, ensure at least one placeholder
    if (doc.imageUrls.length > 0 && doc.imageRenditions.length === 0) {
      const url = doc.imageUrls[0] || '/placeholder.svg';
      doc.imageRenditions.push({
        original: url,
        medium: url,
        thumbnail: url,
        webp: null,
        avif: null,
        uploadId: null,
        originalS3Key: deriveS3KeyFromUrl(url),
      });
      changed = true;
    }

    // If imageRenditions longer than imageUrls, optionally trim or leave as-is.
    // We'll keep them but ensure imageUrls has placeholders so arrays align.
    if (doc.imageRenditions.length > imageUrls.length) {
      // Pad imageUrls so lengths match (avoid index mismatches)
      for (let i = imageUrls.length; i < doc.imageRenditions.length; i++) {
        const rend = doc.imageRenditions[i];
        const fallbackUrl = rend?.medium || rend?.original || '/placeholder.svg';
        doc.imageUrls = doc.imageUrls || [];
        doc.imageUrls.push(fallbackUrl);
        changed = true;
      }
    }

    if (changed) {
      await doc.save();
      updated++;
      if (updated % 50 === 0) console.log(`Backfilled ${updated} products...`);
    }
  }

  console.log(`Done. Checked ${checked} products. Backfilled ${updated} products.`);
  await mongoose.disconnect();
  process.exit(0);
}

run().catch(err => {
  console.error('Backfill error:', err);
  process.exit(1);
});
