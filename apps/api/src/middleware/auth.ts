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

// Specific admin roles
export const requireRole = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Access denied. Required role: ${roles.join(" or ")}`,
      })
    }
    next()
  }
}
