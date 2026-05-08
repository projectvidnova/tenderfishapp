import { isObjectStorageConfigured, uploadFile } from "../lib/storage";

export type DocumentVersionRow = {
  version: number;
  date: string;
  uploadedBy: string;
  status: string;
  changesNote?: string;
  filePath: string;
};

/**
 * When S3-compatible storage is configured, uploads the file and returns a `versions` array entry.
 * Otherwise returns null (document stays with empty versions; gate rescan cannot re-fetch bytes).
 *
 * Pass `version` to upload subsequent versions to a distinct S3 path; defaults to 1 for the
 * first version (intake / fresh-document paths).
 */
export async function tryPersistDocumentFileToStorage(params: {
  workspaceId: string;
  projectId: string;
  documentId: string;
  fileName: string;
  buffer: Buffer;
  contentType: string;
  uploadedBy: string;
  version?: number;
}): Promise<DocumentVersionRow[] | null> {
  if (!isObjectStorageConfigured()) return null;

  const version = params.version ?? 1;
  try {
    const filePath = await uploadFile({
      workspaceId: params.workspaceId,
      projectId: params.projectId,
      documentId: params.documentId,
      version,
      fileName: params.fileName,
      fileBuffer: params.buffer,
      contentType: params.contentType,
    });

    return [
      {
        version,
        date: new Date().toISOString(),
        uploadedBy: params.uploadedBy,
        status: "draft",
        filePath,
      },
    ];
  } catch {
    return null;
  }
}
