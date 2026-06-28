// Local-disk storage adapter (dev default). Writes under STORAGE_LOCAL_PATH.
// For production, swap STORAGE_DRIVER to a cloud adapter — no app code changes.

import { promises as fs, createReadStream } from "node:fs"
import { dirname, join, normalize } from "node:path"
import { Readable } from "node:stream"
import type { StorageAdapter } from "./index"

const ROOT = process.env.STORAGE_LOCAL_PATH || "./uploads"

export class LocalStorageAdapter implements StorageAdapter {
  // Resolve a key to an absolute-ish path under ROOT, stripping any `..` traversal.
  private resolve(key: string): string {
    const safe = normalize(key).replace(/^(\.\.(\/|\\|$))+/, "")
    return join(ROOT, safe)
  }

  async save(key: string, body: Buffer, _contentType: string): Promise<void> {
    const path = this.resolve(key)
    await fs.mkdir(dirname(path), { recursive: true })
    await fs.writeFile(path, body)
  }

  // Served by the API file route (added when a consumer needs it). Relative path.
  async getUrl(key: string): Promise<string> {
    return `/api/files/${key}`
  }

  async getStream(key: string): Promise<Readable> {
    return createReadStream(this.resolve(key))
  }

  async delete(key: string): Promise<void> {
    await fs.rm(this.resolve(key), { force: true })
  }
}
