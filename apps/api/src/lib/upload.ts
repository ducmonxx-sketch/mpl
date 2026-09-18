// Upload primitive — parse a multipart image into memory, normalise it with sharp, then
// persist via the configured storage adapter. Consumers add a Prisma field for the returned
// key and an endpoint that runs `uploadImageField()` then `saveUpload`.
//
// Everything uploaded is re-encoded to WebP here. Two profiles, because the two kinds of
// image have opposite requirements (see DEPLOYMENT-NAS.md §2.3):
//
//   "evidence"  — shipment photos: handover proof, POD, plant-check, defect evidence.
//                 Kept at FULL resolution: being able to zoom in on a scratch is the whole
//                 point, so downscaling would destroy the thing the photo exists for.
//                 Affordable because these are purged after 14 days (§2.4).
//                 Also gets a 400px thumbnail so lists and reports never fetch a ~2.5 MB
//                 original just to render a table row.
//
//   "avatar"    — profile pictures. Downscaled to 512px, single output. These are NOT
//                 covered by the 14-day purge (they're profile data, not evidence), so they
//                 live forever — storing a 4 MB phone photo to render a 128px circle would
//                 be permanent bloat. No thumbnail: at 512px it already is one.
//
// A side effect of re-encoding: sharp drops metadata unless asked to keep it, so EXIF —
// including GPS coordinates and device details — is stripped. That's a privacy win, and the
// reason `.rotate()` below is mandatory rather than optional.

import multer from "multer"
import sharp, { type OutputInfo } from "sharp"
import type { Request, Response, NextFunction } from "express"
import { randomUUID } from "node:crypto"
import { getStorage } from "./storage"

// Raised from 5 MB. The old limit ran BEFORE any processing, so it rejected most raw phone
// photos outright — a driver's upload of delivery proof would simply fail. We accept a large
// original and shrink it ourselves; the cap remains only as a DoS bound.
const MAX_BYTES = 25 * 1024 * 1024 // 25 MB

// HEIC/HEIF included because iOS shoots HEIC by default, so without it every iPhone upload
// is rejected. Verified decodable by this sharp build (libvips 8.18.6, heif input=yes).
// ⚠️ PDFs are deliberately absent: this pipeline re-encodes to WebP, and sharp cannot read
// PDF anyway. Surat Jalan documents must not be routed through here.
const IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
])

export type ImageProfile = "avatar" | "evidence"

const AVATAR_MAX_DIM = 512
const THUMB_MAX_DIM  = 400
const FULL_QUALITY   = 82
const THUMB_QUALITY  = 70

// Multer middleware: one image field, parsed to a Buffer in memory, size + type guarded.
export const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    if (IMAGE_MIMES.has(file.mimetype)) cb(null, true)
    else cb(new Error("Hanya gambar JPG, PNG, WEBP, atau HEIC yang diperbolehkan."))
  },
})

// Route middleware: parse a single image field and turn multer errors (size/type)
// into a clean 400 instead of bubbling to the default error handler.
export function uploadImageField(field = "file") {
  const handler = uploadImage.single(field)
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res, (err: unknown) => {
      if (err) {
        const message = err instanceof Error ? err.message : "Gagal mengunggah file."
        return res.status(400).json({ message })
      }
      next()
    })
  }
}

export interface SavedFile {
  key: string
  url: string
  /** Only for the "evidence" profile. */
  thumbKey?: string
  thumbUrl?: string
  width?: number
  height?: number
  bytes: number
}

/** Thumbnails sit beside the original on the same uuid, so one key derives the other. */
export function thumbKeyFor(key: string): string {
  return key.replace(/\.webp$/, ".thumb.webp")
}

export class ImageProcessingError extends Error {}

/**
 * Persist a parsed multer file under `category/entityId/<uuid>.webp`.
 * The client filename is never used (prevents overwrite / path traversal / enumeration).
 */
export async function saveUpload(
  category: string,
  entityId: string,
  file: Express.Multer.File,
  profile: ImageProfile = "avatar",
): Promise<SavedFile> {
  // `.rotate()` FIRST and always. Re-encoding drops the EXIF orientation flag, so without
  // auto-orienting here every photo from a phone held sideways is stored sideways — and once
  // the flag is gone there is nothing left to correct it with.
  const base = sharp(file.buffer).rotate()

  let fullBuf: Buffer
  let info: OutputInfo
  try {
    if (profile === "avatar") {
      const out = await base
        .resize({ width: AVATAR_MAX_DIM, height: AVATAR_MAX_DIM, fit: "inside", withoutEnlargement: true })
        .webp({ quality: FULL_QUALITY })
        .toBuffer({ resolveWithObject: true })
      fullBuf = out.data
      info = out.info
    } else {
      // No resize — full resolution is the point. Format conversion only.
      const out = await base
        .webp({ quality: FULL_QUALITY })
        .toBuffer({ resolveWithObject: true })
      fullBuf = out.data
      info = out.info
    }
  } catch (err) {
    // A corrupt or truncated image is the caller's problem, not a server fault.
    throw new ImageProcessingError(
      err instanceof Error ? err.message : "Gambar tidak dapat diproses.",
    )
  }

  // Always .webp: the stored format no longer depends on what was uploaded.
  const key = `${category}/${entityId}/${randomUUID()}.webp`
  const storage = getStorage()
  await storage.save(key, fullBuf, "image/webp")

  const saved: SavedFile = {
    key,
    url: await storage.getUrl(key),
    width: info.width,
    height: info.height,
    bytes: info.size,
  }

  if (profile === "evidence") {
    // Re-read from the source buffer rather than chaining off `base`: a sharp instance is
    // single-use once consumed by toBuffer().
    const thumbBuf = await sharp(file.buffer)
      .rotate()
      .resize({ width: THUMB_MAX_DIM, height: THUMB_MAX_DIM, fit: "inside", withoutEnlargement: true })
      .webp({ quality: THUMB_QUALITY })
      .toBuffer()
    const tKey = thumbKeyFor(key)
    await storage.save(tKey, thumbBuf, "image/webp")
    saved.thumbKey = tKey
    saved.thumbUrl = await storage.getUrl(tKey)
  }

  return saved
}

/** Remove a stored image and its thumbnail if one exists (absent keys are a no-op). */
export async function deleteUpload(key: string): Promise<void> {
  const storage = getStorage()
  await storage.delete(key)
  const tKey = thumbKeyFor(key)
  if (tKey !== key) await storage.delete(tKey)
}
