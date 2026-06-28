// Pluggable file storage.
//
// Bytes go to a backend (local disk in dev; cloud object storage in prod); the
// DB stores only the returned key string. The backend is chosen at startup by
// STORAGE_DRIVER so dev↔prod is an env change, not a code change.
//
//   STORAGE_DRIVER=local   → LocalStorageAdapter (apps/api/uploads)
//   STORAGE_DRIVER=s3      → (add S3StorageAdapter when going cloud)

import { Readable } from "node:stream"
import { LocalStorageAdapter } from "./local"

export interface StorageAdapter {
  /** Persist bytes under `key`. */
  save(key: string, body: Buffer, contentType: string): Promise<void>
  /** Resolve a URL for `key` (public path for local; signed URL for private cloud objects). */
  getUrl(key: string): Promise<string>
  /** Open a readable stream for `key` (for auth-gated serving). */
  getStream(key: string): Promise<Readable>
  /** Remove `key` (no error if absent). */
  delete(key: string): Promise<void>
}

let adapter: StorageAdapter | null = null

/** Lazily build and cache the configured storage adapter. */
export function getStorage(): StorageAdapter {
  if (adapter) return adapter

  const driver = process.env.STORAGE_DRIVER || "local"
  switch (driver) {
    case "local":
      adapter = new LocalStorageAdapter()
      break
    // case "s3": adapter = new S3StorageAdapter(); break  // added when going cloud
    default:
      throw new Error(`Unknown STORAGE_DRIVER: "${driver}" (expected "local").`)
  }
  return adapter
}
