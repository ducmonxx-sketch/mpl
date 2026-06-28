import prisma from '../lib/prisma'
import { sendWhatsApp } from './whatsapp'
import { sendEmail } from './email'
import { flagIfExpired } from '../lib/expiry'
import 'dotenv/config'

export async function checkDocumentExpiry() {
  try {
    console.log('[AlertScheduler] Checking for expiring documents...')
    const now = new Date()
    const thirtyDaysFromNow = new Date()
    thirtyDaysFromNow.setDate(now.getDate() + 30)

    const adminWhatsApp = process.env.ADMIN_WHATSAPP
    const adminEmail = process.env.ADMIN_EMAIL

    // Check drivers
    const drivers = await prisma.driver.findMany({
      where: {
        licenseExpiry: {
          lte: thirtyDaysFromNow,
          gte: now,
        },
      },
    })

    for (const driver of drivers) {
      if (!driver.licenseExpiry) continue
      const title = `Driver License Expiring: ${driver.fullName}`
      const message = `License for driver ${driver.fullName} is expiring on ${driver.licenseExpiry.toLocaleDateString()}.`
      await processExpiryAlert(driver.id, 'driver', title, message, adminWhatsApp, adminEmail)
    }

    // Check vehicles
    const vehicles = await prisma.vehicle.findMany({
      where: {
        OR: [
          {
            stnkExpiry: {
              lte: thirtyDaysFromNow,
              gte: now,
            },
          },
          {
            kirExpiry: {
              lte: thirtyDaysFromNow,
              gte: now,
            },
          },
        ],
      },
    })

    for (const vehicle of vehicles) {
      if (vehicle.stnkExpiry && vehicle.stnkExpiry <= thirtyDaysFromNow && vehicle.stnkExpiry >= now) {
        const title = `Vehicle STNK Expiring: ${vehicle.licensePlate}`
        const message = `STNK for vehicle ${vehicle.licensePlate} is expiring on ${vehicle.stnkExpiry.toLocaleDateString()}.`
        await processExpiryAlert(vehicle.id + '-stnk', 'vehicle', title, message, adminWhatsApp, adminEmail)
      }
      if (vehicle.kirExpiry && vehicle.kirExpiry <= thirtyDaysFromNow && vehicle.kirExpiry >= now) {
        const title = `Vehicle KIR Expiring: ${vehicle.licensePlate}`
        const message = `KIR for vehicle ${vehicle.licensePlate} is expiring on ${vehicle.kirExpiry.toLocaleDateString()}.`
        await processExpiryAlert(vehicle.id + '-kir', 'vehicle', title, message, adminWhatsApp, adminEmail)
      }
    }
    // Already-expired docs (admin forgot to renew) → compliance flag for manual cross-check.
    const expiredDrivers = await prisma.driver.findMany({ where: { licenseExpiry: { lt: now } } })
    for (const d of expiredDrivers) {
      await flagIfExpired('driver', d.id, 'SIM/Lisensi', d.fullName, d.licenseExpiry)
    }
    const expiredVehicles = await prisma.vehicle.findMany({
      where: { OR: [{ stnkExpiry: { lt: now } }, { kirExpiry: { lt: now } }] },
    })
    for (const v of expiredVehicles) {
      await flagIfExpired('vehicle', v.id, 'STNK', v.licensePlate, v.stnkExpiry)
      await flagIfExpired('vehicle', v.id, 'KIR', v.licensePlate, v.kirExpiry)
    }

    console.log('[AlertScheduler] Expiry check complete.')
  } catch (error) {
    console.error('[AlertScheduler] Error checking document expiry:', error)
  }
}

async function processExpiryAlert(
  linkId: string,
  linkTo: string,
  title: string,
  message: string,
  adminWhatsApp?: string,
  adminEmail?: string
) {
  const oneDayAgo = new Date()
  oneDayAgo.setDate(oneDayAgo.getDate() - 1)

  const recentNotification = await prisma.adminNotification.findFirst({
    where: {
      linkId,
      category: 'alert',
      createdAt: {
        gte: oneDayAgo,
      },
    },
  })

  if (!recentNotification) {
    await prisma.adminNotification.create({
      data: {
        title,
        message,
        category: 'alert',
        linkTo,
        linkId,
      },
    })

    if (adminWhatsApp) {
      await sendWhatsApp(adminWhatsApp, `*ALERT*\n${title}\n${message}`)
    }
    if (adminEmail) {
      await sendEmail(adminEmail, title, message)
    }
  }
}

export function startAlertScheduler() {
  checkDocumentExpiry()
  // Run every 24 hours
  setInterval(checkDocumentExpiry, 24 * 60 * 60 * 1000)
}
