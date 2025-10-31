import {
  CreateMultipartUploadCommand,
  DeleteObjectCommand, // Add this import
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_SECRET_ACCESS_KEY!,
  },
});

const PUBLIC_R2_DOMAIN = process.env.NEXT_PUBLIC_R2_DOMAIN;

export async function uploadToS3(
  key: string,
  body: Buffer,
  contentType: string
) {
  if (!process.env.S3_BUCKET) {
    throw new Error("S3_BUCKET environment variable is not set");
  }

  const command = new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
  });

  await s3.send(command);
}

export async function deleteFromS3(key: string) {
  if (!process.env.S3_BUCKET) {
    throw new Error("S3_BUCKET environment variable is not set");
  }

  const command = new DeleteObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key,
  });

  await s3.send(command);
}

export async function getS3Url(key: string): Promise<string> {
  try {
    if (PUBLIC_R2_DOMAIN) {
      return `${PUBLIC_R2_DOMAIN}/${key}`;
    }

    // Validate environment variables
    if (!process.env.S3_BUCKET) {
      throw new Error("S3_BUCKET environment variable is not set");
    }

    const command = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
    });

    const signedUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
    return signedUrl;
  } catch (error) {
    throw new Error(`Failed to get S3 URL: ${error}`);
  }
}

export async function createMultipartUpload(
  key: string,
  contentType: string
): Promise<string> {
  // Validate environment variables
  if (!process.env.S3_BUCKET) {
    throw new Error("S3_BUCKET environment variable is not set");
  }

  const command = new CreateMultipartUploadCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key,
    ContentType: contentType,
  });

  const response = await s3.send(command);
  if (!response.UploadId) {
    throw new Error("Failed to create multipart upload");
  }

  return response.UploadId;
}

export function extractKeyFromUrl(url: string): string | null {
  try {
    if (process.env.NEXT_PUBLIC_R2_DOMAIN) {
      if (url.startsWith(process.env.NEXT_PUBLIC_R2_DOMAIN)) {
        return url.replace(`${process.env.NEXT_PUBLIC_R2_DOMAIN}/`, '');
      }
    }

    const urlObj = new URL(url);
    const pathname = urlObj.pathname;

    let key = pathname.startsWith('/') ? pathname.slice(1) : pathname;

    const bucketName = process.env.S3_BUCKET;
    if (bucketName && key.startsWith(`${bucketName}/`)) {
      key = key.slice(bucketName.length + 1);
    }

    return key || null;
  } catch {
    return null;
  }
}