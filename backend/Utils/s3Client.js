import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import dotenv from 'dotenv';

dotenv.config();
const s3 = new S3Client({
  region: "us-east-1", // dummy for MinIO
  endpoint: process.env.MINIO_URL,
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY,
    secretAccessKey: process.env.MINIO_SECRET_KEY
  },
  forcePathStyle: true // REQUIRED for MinIO
});
export default s3;