import 'dotenv/config'

// ============================================================
// WhatsApp delivery via OpenWA (self-hosted gateway).
//
// OpenWA exposes a REST API over a linked WhatsApp Web session:
//   POST {BASE}/api/sessions/{sessionId}/messages/send-text
//   headers: { 'X-API-Key': <key> }
//   body:    { chatId: '628…@c.us', text: '…' }
//
// Config (apps/api/.env):
//   OPENWA_BASE_URL    e.g. http://localhost:2785  (defaults to that)
//   OPENWA_API_KEY     OpenWA's API_MASTER_KEY (ADMIN role) or an OPERATOR key
//   OPENWA_SESSION_ID  the id of the started/linked session in OpenWA
//
// Degrades gracefully: if not configured, logs a warning and returns false
// (same contract as before) so callers never crash.
// ============================================================

const OPENWA_BASE_URL = process.env.OPENWA_BASE_URL || 'http://localhost:2785'
const OPENWA_API_KEY = process.env.OPENWA_API_KEY
const OPENWA_SESSION_ID = process.env.OPENWA_SESSION_ID

/**
 * Normalize a phone number into a WhatsApp chatId (`<intl>@c.us`).
 * Assumes Indonesian numbers when no country code is present:
 *   "0821-1234-5678" -> "62821234 5678@c.us"  (leading 0 -> 62)
 *   "+62812…"        -> "62812…@c.us"          ('+' stripped)
 *   "62812…"         -> "62812…@c.us"          (kept as-is)
 *   "812…"           -> "62812…@c.us"          (assumed local, prefixed 62)
 */
function toChatId(phoneNumber: string): string | null {
  if (!phoneNumber) return null
  let digits = phoneNumber.replace(/\D/g, '') // digits only (drops '+', spaces, dashes)
  if (!digits) return null
  if (digits.startsWith('0')) digits = '62' + digits.slice(1)
  else if (!digits.startsWith('62')) digits = '62' + digits
  return `${digits}@c.us`
}

export async function sendWhatsApp(phoneNumber: string, message: string): Promise<boolean> {
  if (!OPENWA_API_KEY || !OPENWA_SESSION_ID) {
    console.warn('[WhatsApp] OpenWA not configured (OPENWA_API_KEY / OPENWA_SESSION_ID). Message not sent.')
    return false
  }

  const chatId = toChatId(phoneNumber)
  if (!chatId) {
    console.warn('[WhatsApp] Invalid/empty phone number — message not sent:', phoneNumber)
    return false
  }

  const url = `${OPENWA_BASE_URL.replace(/\/$/, '')}/api/sessions/${OPENWA_SESSION_ID}/messages/send-text`
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'X-API-Key': OPENWA_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ chatId, text: message }),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      console.error(`[WhatsApp] OpenWA send failed (${res.status}) to ${chatId}:`, errText)
      return false
    }

    const data = await res.json().catch(() => ({}) as { messageId?: string })
    console.log('[WhatsApp] Sent to', chatId, '— messageId:', (data as { messageId?: string }).messageId)
    return true
  } catch (err) {
    console.error('[WhatsApp] Failed to send via OpenWA:', err)
    return false
  }
}
