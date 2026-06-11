import 'dotenv/config'

const FONNTE_TOKEN = process.env.FONNTE_API_TOKEN

export async function sendWhatsApp(phoneNumber: string, message: string): Promise<boolean> {
  if (!FONNTE_TOKEN) {
    console.warn('[WhatsApp] FONNTE_API_TOKEN not set. Message not sent.')
    return false
  }
  try {
    const res = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: {
        'Authorization': FONNTE_TOKEN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        target: phoneNumber,
        message: message,
      }),
    })
    const data = await res.json()
    console.log('[WhatsApp] Sent to', phoneNumber, ':', data)
    return true
  } catch (err) {
    console.error('[WhatsApp] Failed to send:', err)
    return false
  }
}
