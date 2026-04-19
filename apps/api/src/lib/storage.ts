import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl as s3GetSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import { getEnv } from "./env";

const env = getEnv();

const s3 = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: env.S3_REGION,
  ...(env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY
    ? {
        credentials: {
          accessKeyId: env.S3_ACCESS_KEY_ID,
          secretAccessKey: env.S3_SECRET_ACCESS_KEY,
        },
      }
    : {}),
  forcePathStyle: true, // Required for IONOS S3-compatible storage
});

const bucketName = env.S3_BUCKET_NAME;

interface UploadParams {
  workspaceId: string;
  projectId: string;
  documentId: string;
  version: number;
  fileName: string;
  fileBuffer: Buffer;
  contentType: string;
}

/**
 * Upload a file to S3-compatible storage with the standard path structure.
 * Path: {workspaceId}/projects/{projectId}/documents/{documentId}/v{version}/{fileName}
 */
export async function uploadFile(params: UploadParams): Promise<string> {
  const { workspaceId, projectId, documentId, version, fileName, fileBuffer, contentType } = params;
  const storagePath = `${workspaceId}/projects/${projectId}/documents/${documentId}/v${version}/${fileName}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: storagePath,
      Body: fileBuffer,
      ContentType: contentType,
      Metadata: {
        workspaceid: workspaceId,
        projectid: projectId,
        documentid: documentId,
        version: String(version),
      },
    })
  );

  return storagePath;
}

/**
 * Upload a raw file (e.g. for intake uploads before a document record exists).
 * Path: {workspaceId}/uploads/{uploadId}/{fileName}
 */
export async function uploadRawFile(
  workspaceId: string,
  fileName: string,
  fileBuffer: Buffer,
  contentType: string
): Promise<string> {
  const uploadId = randomUUID();
  const storagePath = `${workspaceId}/uploads/${uploadId}/${fileName}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: storagePath,
      Body: fileBuffer,
      ContentType: contentType,
    })
  );

  return storagePath;
}

/**
 * Generate a signed URL for temporary file access.
 */
export async function getSignedUrl(storagePath: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: storagePath,
  });

  return s3GetSignedUrl(s3, command, {
    expiresIn: Math.floor(env.SIGNED_URL_EXPIRY_MS / 1000),
  });
}

/**
 * Delete a file from S3-compatible storage.
 */
export async function deleteFile(storagePath: string): Promise<void> {
  await s3.send(
    new DeleteObjectCommand({
      Bucket: bucketName,
      Key: storagePath,
    })
  );
}

/**
 * Check if a file exists in S3-compatible storage.
 */
export async function fileExists(storagePath: string): Promise<boolean> {
  try {
    await s3.send(
      new HeadObjectCommand({
        Bucket: bucketName,
        Key: storagePath,
      })
    );
    return true;
  } catch {
    return false;
  }
}

// Supported upload MIME types
export const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-outlook",
  "message/rfc822",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
]);

export const MAX_FILE_SIZE = env.MAX_FILE_SIZE_BYTES;
