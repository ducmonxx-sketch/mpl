// src/routes/files.ts
//
//   GET /api/files/<key>  → stream a stored file (e.g. avatars/<id>/<uuid>.jpg)
//
// PUBLIC (no auth) on purpose: browsers can't attach the Bearer token to <img>
// requests, and the only assets served today are profile pictures — low sensitivity,
// unguessable uuid keys.
// ⚠️ Do NOT serve sensitive files (payment proof, proof-of-delivery, …) through this
// route until we have signed URLs or cookie auth — see DEPLOYMENT.md §3 (deferred auth).

import { Router, Request, Response } from "express"
import { getStorage } from "../lib/storage"

const router = Router()

const MIME_BY_EXT: Record<string, string> = {
  jpg:  "image/jpeg",
  jpeg: "image/jpeg",
  png:  "image/png",
  webp: "image/webp",
}

// Regex route matches the whole sub-path (keys contain "/"), sidestepping Express 5
// named-wildcard syntax. Mounted at /api/files, so req.path is "/avatars/<id>/<uuid>.jpg".
router.get(/.*/, async (req: Request, res: Response) => {
  const key = decodeURIComponent(req.path.replace(/^\/+/, ""))
  if (!key) return res.status(404).json({ message: "File not found." })

  const ext = key.split(".").pop()?.toLowerCase()
  const mime = ext ? MIME_BY_EXT[ext] : undefined
  if (mime) res.type(mime)

  try {
    const stream = await getStorage().getStream(key)
    stream.on("error", () => {
      if (!res.headersSent) res.status(404).json({ message: "File not found." })
    })
    stream.pipe(res)
  } catch {
    res.status(404).json({ message: "File not found." })
  }
})

export default router
