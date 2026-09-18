// src/routes/files.ts
//
//   GET /api/files/<key>  → stream a stored file (e.g. avatars/<id>/<uuid>.jpg)
//
// No Authorization header — a browser cannot attach one to <img src>, which is why this
// route is header-less by necessity rather than by choice.
//
// It is NOT open any more: every request must carry a valid `?exp`/`?sig` pair minted by
// StorageAdapter.getUrl (see lib/fileUrls.ts). The API only mints those inside a response the
// caller was already authorised to receive, so holding a working file URL means the server
// handed it over. This is what unblocks serving sensitive files — proof-of-delivery,
// plant-check evidence, Surat Jalan — which the original version of this comment explicitly
// warned against until "signed URLs or cookie auth" existed. Signed URLs now exist, so the
// cookie rehaul is no longer a prerequisite for the photo features.

import { Router, Request, Response } from "express"
import { getStorage } from "../lib/storage"
import { verifyFileUrl } from "../lib/fileUrls"

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

  const check = verifyFileUrl(key, req.query.exp, req.query.sig)
  if (!check.ok) {
    // Reason is logged, not returned: telling a caller "expired" vs "bad-signature" vs
    // "missing-signature" only helps someone probing the scheme.
    console.warn(`[files] rejected ${key}: ${check.reason}`)
    return res.status(403).json({ message: "File access denied or link expired." })
  }

  const ext = key.split(".").pop()?.toLowerCase()
  const mime = ext ? MIME_BY_EXT[ext] : undefined
  if (mime) res.type(mime)

  // Let the browser cache until the signature expires. This is the other half of the
  // bucketed-expiry design in lib/fileUrls.ts: the URL is byte-identical for the rest of its
  // bucket and the bytes behind a uuid key never change, so without a Cache-Control header
  // the 8s dashboard poll would re-download every photo on every tick and the stable URL
  // would buy nothing.
  //
  // ⚠️ `private` is load-bearing: these responses are access-controlled, so a shared cache
  // (Cloudflare, a corporate proxy) must never store one and serve it to someone else.
  const expMs = Number(req.query.exp)
  const maxAge = Math.max(0, Math.floor((expMs - Date.now()) / 1000))
  res.setHeader("Cache-Control", `private, max-age=${maxAge}, immutable`)

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
