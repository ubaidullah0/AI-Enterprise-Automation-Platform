import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand, HeadBucketCommand, CreateBucketCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import path from 'path';

// Load MinIO Config
const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || 'http://localhost:9000';
const MINIO_ROOT_USER = process.env.MINIO_ROOT_USER;
const MINIO_ROOT_PASSWORD = process.env.MINIO_ROOT_PASSWORD;
const MINIO_BUCKET_NAME = process.env.MINIO_BUCKET_NAME || 'automation-platform-docs';

if (!MINIO_ROOT_USER || !MINIO_ROOT_PASSWORD) {
  console.warn('[Storage] MINIO_ROOT_USER or MINIO_ROOT_PASSWORD is not set. Storage service may fail.');
}

const s3Client = new S3Client({
  region: 'us-east-1', // MinIO requires a region, us-east-1 is standard
  endpoint: MINIO_ENDPOINT,
  credentials: {
    accessKeyId: MINIO_ROOT_USER || '',
    secretAccessKey: MINIO_ROOT_PASSWORD || '',
  },
  forcePathStyle: true, // Crucial for MinIO
});

/**
 * Initializes the MinIO bucket if it doesn't exist
 */
export const initializeStorage = async () => {
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: MINIO_BUCKET_NAME }));
    console.log(`[Storage] Bucket '${MINIO_BUCKET_NAME}' exists.`);
  } catch (error: any) {
    if (error.name === 'NotFound') {
      console.log(`[Storage] Bucket '${MINIO_BUCKET_NAME}' not found. Creating...`);
      await s3Client.send(new CreateBucketCommand({ Bucket: MINIO_BUCKET_NAME }));
      console.log(`[Storage] Bucket '${MINIO_BUCKET_NAME}' created successfully.`);
    } else {
      console.error('[Storage] Error checking/creating bucket:', error);
    }
  }
};

/**
 * Uploads a buffer to MinIO
 */
export const uploadBuffer = async (
  buffer: Buffer,
  mimetype: string,
  originalName: string,
  organizationId: string
): Promise<{ fileUrl: string; size: number; fileName: string }> => {
  const extension = path.extname(originalName);
  const fileKey = `${organizationId}/${randomUUID()}${extension}`;

  const command = new PutObjectCommand({
    Bucket: MINIO_BUCKET_NAME,
    Key: fileKey,
    Body: buffer,
    ContentType: mimetype,
  });

  await s3Client.send(command);

  return {
    fileUrl: fileKey, // Storing the object key as fileUrl
    size: buffer.length,
    fileName: originalName,
  };
};

/**
 * Deletes an object from MinIO
 */
export const deleteObject = async (fileKey: string): Promise<void> => {
  const command = new DeleteObjectCommand({
    Bucket: MINIO_BUCKET_NAME,
    Key: fileKey,
  });

  await s3Client.send(command);
};

/**
 * Generates a temporary, secure pre-signed URL for downloading
 */
export const getPresignedDownloadUrl = async (fileKey: string, expiresIn = 3600): Promise<string> => {
  const command = new GetObjectCommand({
    Bucket: MINIO_BUCKET_NAME,
    Key: fileKey,
  });

  // URL expires in 1 hour by default
  const url = await getSignedUrl(s3Client, command, { expiresIn });
  return url;
};
