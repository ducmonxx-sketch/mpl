// src/middleware/auth.ts

import { Request, Response, NextFunction } from "express"
import jwt from "jsonwebtoken"

export interface AuthRequest extends Request {
  user?: {
    id:   string
    role: string
    type: "user" | "admin"
  }
}

// Any logged-in user (client or admin)
export const authenticate = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const token = req.headers.authorization?.split(" ")[1]

  if (!token) {
    return res.status(401).json({ message: "No token provided. Please log in." })
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as AuthRequest["user"]
    req.user = decoded
    next()
  } catch {
    return res.status(401).json({ message: "Invalid or expired token." })
  }
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
