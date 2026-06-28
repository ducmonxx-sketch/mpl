// Upload primitive — parse a multipart image into memory, then persist it via the
// configured storage adapter. Consumers add a Prisma field for the returned key
// and an endpoint that runs `uploadImage` then `saveUpload`.

import multer from "multer"
import { randomUUID } from "node:crypto"
import { getStorage } from "./storage"

const MAX_BYTES = 5 * 1024 * 1024 // 5 MB
const IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/webp"])
const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png":  "png",
  "image/webp": "webp",
}

// Multer middleware: one image field, parsed to a Buffer in memory, size + type guarded.
export const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    if (IMAGE_MIMES.has(file.mimetype)) cb(null, true)
    else cb(new Error("Hanya gambar JPG, PNG, atau WEBP yang diperbolehkan."))
  },
})

export interface SavedFile {
  key: string
  url: string
}

// Persist a parsed multer file under `category/entityId/<uuid>.<ext>`; returns key + url.
// The client filename is never used (prevents overwrite / path-traversal / enumeration).
export async function saveUpload(
  category: string,
  entityId: string,
  file: Express.Multer.File,
): Promise<SavedFile> {
  const ext = EXT_BY_MIME[file.mimetype] ?? "bin"
  const key = `${category}/${entityId}/${randomUUID()}.${ext}`
  const storage = getStorage()
  await storage.save(key, file.buffer, file.mimetype)
  return { key, url: await storage.getUrl(key) }
}

export async function deleteUpload(key: string): Promise<void> {
  await getStorage().delete(key)
}
