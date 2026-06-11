import nodemailer from 'nodemailer'
import 'dotenv/config'

const transporter = process.env.SMTP_HOST ? nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
}) : null

export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!transporter) {
    console.warn('[Email] SMTP not configured. Email not sent.')
    return false
  }
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'admin@mpl.co.id',
      to,
      subject,
      html,
    })
    console.log('[Email] Sent to', to)
    return true
  } catch (err) {
    console.error('[Email] Failed to send:', err)
    return false
  }
}
