// Local-disk storage adapter (dev default). Writes under STORAGE_LOCAL_PATH.
// For production, swap STORAGE_DRIVER to a cloud adapter — no app code changes.

import { promises as fs, createReadStream } from "node:fs"
import { dirname, join, normalize } from "node:path"
import { Readable } from "node:stream"
import type { StorageAdapter } from "./index"
import { signFileUrl } from "../fileUrls"

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

  // Served by the API file route, as a SIGNED relative URL — see lib/fileUrls.ts. This is
  // the only place local file URLs are produced, so signing here covers every consumer
  // (currently auth.ts + users.ts avatar responses and saveUpload's return value) without
  // any caller needing to know about it.
  async getUrl(key: string): Promise<string> {
    return signFileUrl(key)
  }

  async getStream(key: string): Promise<Readable> {
    return createReadStream(this.resolve(key))
  }

  async delete(key: string): Promise<void> {
    await fs.rm(this.resolve(key), { force: true })
  }
}
