// src/lib/expiry.ts
//
// Compliance flagging for document expiry (driver SIM, vehicle STNK/KIR).
// Admins MAY record/update an expiry even after it has lapsed (no past-date block);
// when the recorded date is already in the past we raise a "missed deadline" admin
// notification (category "compliance") for manual cross-check. Deduped per document
// within 24h so the same lapse isn't flagged repeatedly.

import prisma from "./prisma"

const DAY_MS = 24 * 60 * 60 * 1000

export function isExpired(date: Date | null | undefined): boolean {
  return !!date && date.getTime() < Date.now()
}

// If `expiry` is already in the past, raise a deduped compliance notification.
// No-op when the date is null/future.
export async function flagIfExpired(
  linkTo: "driver" | "vehicle",
  linkId: string,
  docLabel: string,
  name: string,
  expiry: Date | null | undefined,
): Promise<void> {
  if (!isExpired(expiry)) return

  const title = `Dokumen kedaluwarsa: ${name} — ${docLabel}`
  const recent = await prisma.adminNotification.findFirst({
    where: { title, category: "compliance", createdAt: { gte: new Date(Date.now() - DAY_MS) } },
  })
  if (recent) return

  await prisma.adminNotification.create({
    data: {
      title,
      message:  `${docLabel} untuk ${name} tercatat sudah kedaluwarsa (${expiry!.toLocaleDateString("id-ID")}). Mohon diperiksa/diperbarui.`,
      category: "compliance",
      linkTo,
      linkId,
    },
  })
}
