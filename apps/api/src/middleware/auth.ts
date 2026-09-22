// src/middleware/auth.ts

import { Request, Response, NextFunction } from "express"
import { readSessionCookie, resolveSession } from "../lib/session"

export interface AuthRequest extends Request {
  user?: {
    id:   string
    role: string
    type: "user" | "admin"
  }
}

// Any logged-in user (client or admin).
//
// Authenticated purely by the httpOnly session cookie. The Bearer fallback that made the
// 2a migration non-breaking was removed once the frontend cut over (2f), so there is no
// longer any JS-readable credential to steal.
export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const cookieToken = readSessionCookie(req)
  if (cookieToken) {
    try {
      const principal = await resolveSession(cookieToken)
      if (principal) {
        req.user = principal
        return next()
      }
      // A present-but-invalid cookie (revoked, expired, idled out) is an explicit 401 rather
      // than a silent fall-through to Bearer: the caller has a session that is genuinely
      // over, and should be told to log in again.
      return res.status(401).json({ message: "Session expired. Please log in again." })
    } catch (err) {
      console.error("[auth] session lookup failed:", err)
      return res.status(500).json({ message: "Authentication error." })
    }
  }

  // No session cookie: not authenticated. The legacy `Authorization: Bearer` path was
  // removed at 2f — leaving it would have kept a 7-day, non-revocable,
  // XSS-exfiltratable credential valid alongside the sessions built to replace it.
  return res.status(401).json({ message: "No session. Please log in." })
}

// Admin only
export const adminOnly = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user || req.user.type !== "admin") {
    return res.status(403).json({ message: "Access denied. Admins only." })
  }
  next()
}

// Specific admin roles. SUPERADMIN is a superuser — it bypasses every role gate,
// so it can perform any action regardless of the required-role list.
//
// ⚠️ The `type === "admin"` assertion is deliberate and must stay. This guard used to check
// only `role`, which made it safe purely by accident: client tokens are signed with
// role "user" (routes/auth.ts), so they happened not to match any role list. That is a
// fragile invariant — anything that gave a client token an admin-shaped role, or a route
// written as requireRole("user"), would have let a client straight through an admin gate.
// `requirePermission` in lib/rbac.ts has always checked the type; this now matches it.
export const requireRole = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || req.user.type !== "admin") {
      return res.status(403).json({ message: "Access denied. Admins only." })
    }
    if (req.user.role === "SUPERADMIN") return next()
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Access denied. Required role: ${roles.join(" or ")}`,
      })
    }
    next()
  }
}

// Client management (create/onboard clients + registration magic links).
// SUPERADMIN + OPERATIONS only — pipeline roles (Kepala Armada, PIC Pabrik/Gudang) are excluded.
export const clientManagerOnly = requireRole("SUPERADMIN", "OPERATIONS")
