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

function storageBucket(): string {
  const b = process.env.FIREBASE_STORAGE_BUCKET;
  if (!b) throw new Error("FIREBASE_STORAGE_BUCKET env var is not set");
  return b;
}

/** Returns true when Firebase Storage is configured. */
export function useFirebaseStorage(): boolean {
  return !!process.env.FIREBASE_STORAGE_BUCKET;
}

// ─── Firebase Storage (production) ──────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _bucket: any = null;

async function getFirebaseBucket() {
  if (_bucket) return _bucket;

  // Use firebase-admin — on Firebase App Hosting ADC is automatic.
  // Falls back to cert() credentials if env vars are set.
  const { getApps, initializeApp, cert } = await import("firebase-admin/app");
  const { getStorage } = await import("firebase-admin/storage");

  let app;
  if (getApps().length) {
    app = getApps()[0];
  } else if (
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  ) {
    app = initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      }),
    });
  } else {
    // Application Default Credentials (Firebase App Hosting / Cloud Run)
    app = initializeApp();
  }

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
  });
  // Firebase Storage download URL (works with Rules: allow read: if true)
  const encodedPath = encodeURIComponent(storagePath);
  return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media`;
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
 * Delete a file given its stored URL.
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
 * Firebase Storage URL (new format):
 *   https://firebasestorage.googleapis.com/v0/b/{bucket}/o/uploads%2Forders%2F...?alt=media
 *   → uploads/orders/...
 *
 * Firebase Storage URL (old format):
 *   https://storage.googleapis.com/{bucket}/uploads/orders/...
 *   → uploads/orders/...
 *
 * Local URL:
 *   /uploads/orders/...
 *   → uploads/orders/...
 */
export function storagePathFromUrl(url: string): string {
  if (url.startsWith("https://firebasestorage.googleapis.com/")) {
    const match = url.match(/\/o\/([^?]+)/);
    return match ? decodeURIComponent(match[1]) : url;
  }
  if (url.startsWith("https://storage.googleapis.com/")) {
    const withoutScheme = url.replace("https://storage.googleapis.com/", "");
    const slashIdx = withoutScheme.indexOf("/");
    return slashIdx >= 0 ? withoutScheme.slice(slashIdx + 1) : withoutScheme;
  }
  return url.startsWith("/") ? url.slice(1) : url;
}
