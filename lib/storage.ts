/**
 * Unified file storage utility.
 *
 * Production (Firebase App Hosting):  uses Firebase Storage.
 *   - Set FIREBASE_STORAGE_BUCKET env var (e.g. alarmy-serwis.firebasestorage.app)
 *   - Credentials come from Application Default Credentials automatically.
 *
 * Local dev (no FIREBASE_STORAGE_BUCKET):  falls back to public/ directory.
 */

import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";

// ─── helpers ────────────────────────────────────────────────────────────────

function storageBucket(): string | undefined {
  return process.env.FIREBASE_STORAGE_BUCKET;
}

/** Returns true when Firebase Storage is configured. */
export function useFirebaseStorage(): boolean {
  return !!storageBucket();
}

// ─── Firebase Storage (production) ──────────────────────────────────────────

let _bucket: import("@google-cloud/storage").Bucket | null = null;

async function getFirebaseBucket() {
  if (_bucket) return _bucket;
  // Ensure firebase-admin is initialized (uses existing app if already initialized)
  await import("./firebase-admin");
  const { getApps } = await import("firebase-admin/app");
  const { getStorage } = await import("firebase-admin/storage");
  const app = getApps()[0];
  _bucket = getStorage(app).bucket(storageBucket());
  return _bucket;
}

async function firebaseUpload(
  storagePath: string,
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  const bucket = await getFirebaseBucket();
  const file = bucket.file(storagePath);
  await file.save(buffer, {
    metadata: { contentType: mimeType },
    resumable: false,
    public: true,
  });
  // Public URL format
  return `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
}

async function firebaseDelete(storagePath: string): Promise<void> {
  try {
    const bucket = await getFirebaseBucket();
    await bucket.file(storagePath).delete();
  } catch {
    // ignore missing files
  }
}

// ─── Local filesystem (dev fallback) ────────────────────────────────────────

async function localUpload(
  storagePath: string,
  buffer: Buffer
): Promise<string> {
  const fullPath = path.join(process.cwd(), "public", storagePath);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, buffer);
  return `/${storagePath}`;
}

async function localDelete(storagePath: string): Promise<void> {
  try {
    await unlink(path.join(process.cwd(), "public", storagePath));
  } catch {
    // ignore missing files
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Upload a file and return its public URL.
 * @param storagePath  Path inside storage, e.g. "uploads/orders/xxx/photo.jpg"
 */
export async function uploadFile(
  storagePath: string,
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  if (useFirebaseStorage()) {
    return firebaseUpload(storagePath, buffer, mimeType);
  }
  return localUpload(storagePath, buffer);
}

/**
 * Delete a file given its stored URL or storage path.
 */
export async function deleteFile(fileUrl: string): Promise<void> {
  const storagePath = storagePathFromUrl(fileUrl);
  if (useFirebaseStorage()) {
    return firebaseDelete(storagePath);
  }
  return localDelete(storagePath);
}

/**
 * Fetch a file as a Buffer from its stored URL.
 * Works with both Firebase Storage public URLs and local /uploads/... paths.
 */
export async function fetchFileBuffer(
  fileUrl: string,
  baseUrl?: string
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  try {
    const url = fileUrl.startsWith("http")
      ? fileUrl
      : `${baseUrl ?? "http://localhost:3000"}${fileUrl}`;

    const res = await fetch(url);
    if (!res.ok) return null;
    const mimeType = res.headers.get("content-type") ?? "application/octet-stream";
    const buffer = Buffer.from(await res.arrayBuffer());
    return { buffer, mimeType };
  } catch {
    return null;
  }
}

/**
 * Extract the storage path from a URL.
 *
 * Firebase Storage URL:
 *   https://storage.googleapis.com/{bucket}/uploads/orders/...
 *   → uploads/orders/...
 *
 * Local URL:
 *   /uploads/orders/...
 *   → uploads/orders/...
 */
export function storagePathFromUrl(url: string): string {
  if (url.startsWith("https://storage.googleapis.com/")) {
    // strip scheme + hostname + bucket segment
    const withoutScheme = url.replace("https://storage.googleapis.com/", "");
    const slashIdx = withoutScheme.indexOf("/");
    return slashIdx >= 0 ? withoutScheme.slice(slashIdx + 1) : withoutScheme;
  }
  // local: /uploads/... → uploads/...
  return url.startsWith("/") ? url.slice(1) : url;
}
