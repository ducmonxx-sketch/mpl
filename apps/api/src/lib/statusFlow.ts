// src/lib/statusFlow.ts
//
// Directional status state machine for shipments.
// Regular admins may only move a record FORWARD along the normal flow; reversing or
// jumping to an off-flow state requires the super-admin "status:override" permission
// (used to audit/fix admin mistakes). Same → same is an allowed no-op.

import { roleHas } from "./rbac"

export type StatusKind = "shipment"

// Forward transitions a regular admin may perform. Keys also define the valid statuses.
const FORWARD: Record<StatusKind, Record<string, string[]>> = {
  shipment: {
    PENDING:    ["STANDBY"],              // admin-created → armada picks up (Menunggu → Standby)
    STANDBY:    ["DITUGASKAN"],           // armada reconfirms driver availability → Ditugaskan
    DITUGASKAN: ["AT_PLANT"],            // PIC Pabrik confirms arrival at plant (mandatory step)
    AT_PLANT:   ["TRANSIT"],             // PIC Pabrik completes the check → departs
    TRANSIT:    ["DITERIMA", "DELIVERED", "CANCELLED"], // Gudang leg: → Diterima; DELIVERED kept for direct handover
    DITERIMA:   ["DITURUNKAN", "CANCELLED"],
    DITURUNKAN: ["DELIVERED"],
    DELIVERED:  [],
    FAILED:     [],  // legacy; no longer offered as a forward option
    CANCELLED:  [],
  },
}

export function isValidStatus(kind: StatusKind, status: string): boolean {
  return status in (FORWARD[kind] ?? {})
}

export function isForward(kind: StatusKind, from: string, to: string): boolean {
  if (from === to) return true
  return FORWARD[kind]?.[from]?.includes(to) ?? false
}

// A reversal / off-flow move (used for audit flagging).
export function isReversal(kind: StatusKind, from: string, to: string): boolean {
  return from !== to && !isForward(kind, from, to)
}

// Can `role` move `kind` from→to? Forward (or same) → any admin; otherwise needs status:override.
export function canChangeStatus(role: string | undefined, kind: StatusKind, from: string, to: string): boolean {
  if (isForward(kind, from, to)) return true
  return roleHas(role, "status:override")
}
