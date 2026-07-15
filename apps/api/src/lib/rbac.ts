// src/lib/rbac.ts
//
// Role-based permissions for admins — a declarative layer over the JWT role
// (req.user.role). Gate routes by *capability* (requirePermission) rather than by
// raw role strings, so the whole policy lives in one matrix and new gates (including
// future page/feature-level ones, e.g. "page:clients") slot in without rework.
//
// Admin roles (schema enum AdminRole): SUPERADMIN | OPERATIONS | SUPPORT |
// KEPALA_ARMADA | PIC_PABRIK | PIC_GUDANG.
// SUPERADMIN = super-admin; everyone else is a scoped/regular admin with no elevated
// permissions here (pipeline roles are gated per-status in the UI, not via this matrix).
// See RBAC-PLAN.md.

import type { Response, NextFunction } from "express"
import type { AuthRequest } from "../middleware/auth"

export type Permission =
  | "status:override" // change shipment/invoice status backward / off the normal flow
  | "admin:manage"    // list/create admins, reset admin passwords, view internal users

// Single source of truth: which roles hold which permissions.
const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  SUPERADMIN:    ["status:override", "admin:manage"],
  OPERATIONS:    [],
  SUPPORT:       [],
  KEPALA_ARMADA: [],
  PIC_PABRIK:    [],
  PIC_GUDANG:    [],
}

export function roleHas(role: string | undefined, perm: Permission): boolean {
  if (!role) return false
  return ROLE_PERMISSIONS[role]?.includes(perm) ?? false
}

// Middleware: allow only admins whose role grants `perm`.
export function requirePermission(perm: Permission) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || req.user.type !== "admin") {
      return res.status(403).json({ message: "Akses ditolak. Khusus admin." })
    }
    if (!roleHas(req.user.role, perm)) {
      return res.status(403).json({ message: "Akses ditolak. Khusus Super Admin." })
    }
    next()
  }
}
