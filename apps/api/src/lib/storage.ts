import { Storage } from "@google-cloud/storage";
import { randomUUID } from "crypto";

const bucketName = process.env.GCS_BUCKET_NAME || "tenderfish-dev-files";

const storage = new Storage({
  projectId: process.env.GCS_PROJECT_ID,
});

const bucket = storage.bucket(bucketName);

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
 * Upload a file to GCS with the standard path structure.
 * Path: {workspaceId}/projects/{projectId}/documents/{documentId}/v{version}/{fileName}
 */
export async function uploadFile(params: UploadParams): Promise<string> {
  const { workspaceId, projectId, documentId, version, fileName, fileBuffer, contentType } = params;
  const storagePath = `${workspaceId}/projects/${projectId}/documents/${documentId}/v${version}/${fileName}`;

  const file = bucket.file(storagePath);

  await file.save(fileBuffer, {
    metadata: {
      contentType,
      metadata: {
        workspaceId,
        projectId,
        documentId,
        version: String(version),
      },
    },
  });

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

  const file = bucket.file(storagePath);

  await file.save(fileBuffer, {
    metadata: { contentType },
  });

  return storagePath;
}

/**
 * Generate a signed URL for temporary file access (15 minutes).
 */
export async function getSignedUrl(storagePath: string): Promise<string> {
  const file = bucket.file(storagePath);

  const [url] = await file.getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + 15 * 60 * 1000, // 15 minutes
  });

  return url;
}

/**
 * Delete a file from GCS.
 */
export async function deleteFile(storagePath: string): Promise<void> {
  const file = bucket.file(storagePath);
  await file.delete({ ignoreNotFound: true });
}

/**
 * Check if a file exists in GCS.
 */
export async function fileExists(storagePath: string): Promise<boolean> {
  const file = bucket.file(storagePath);
  const [exists] = await file.exists();
  return exists;
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

export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
