import { PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";
import s3Client from "./s3Client.js";
import { logger } from "./logger.js";

const S3_BUCKET_NAME = process.env.MINIO_BUCKET_NAME || "e-store-images";
const MINIO_URL = process.env.MINIO_URL || "http://localhost:9000";

// Map MIME types to extensions explicitly
const extMap = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const uploadFileToS3 = async (fileBuffer, mimetype, key) => { // Changed 'folder' to 'key'
  // The 'key' parameter now directly represents the full S3 key to use.
  // The unique filename generation logic is removed from here as it's handled by the caller.

  const uploadParams = {
    Bucket: S3_BUCKET_NAME,
    Key: key, // Use the provided key directly
    Body: fileBuffer,
    ContentType: mimetype,
  };

  try {
    await s3Client.send(new PutObjectCommand(uploadParams));
    logger.info(`✅ File uploaded: ${key}`); // Log the correct key
    const publicUrl = `${MINIO_URL}/${S3_BUCKET_NAME}/${key}`; // Construct URL with the correct key
    return publicUrl;
  } catch (error) {
    logger.error(`❌ Upload failed: ${error.message}`, { error });
    throw new Error(`Failed to upload image: ${error.message}`);
  }
};