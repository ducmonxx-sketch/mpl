# Mahkota Putra Logistik — Admin Dashboard
## Product Planning Document (Google Antigravity Edition)
**Version:** 1.1 — Updated  
**Date:** April 2026  
**Prepared by:** AI Product Planner  
**Status:** 🟡 In Review — Open decisions marked with `[OPEN DECISION]`  
**Changelog:** v1.1 — Added Section 6: Authentication Strategy + Tech Stack

---

## Table of Contents
1. [Product Requirements Document (PRD)](#1-product-requirements-document-prd)
2. [App Flow](#2-app-flow)
3. [Low-Fidelity Wireframes](#3-low-fidelity-wireframes)
4. [Database Schema](#4-database-schema)
5. [Open Decisions & Next Steps](#5-open-decisions--next-steps)
6. [Authentication Strategy](#6-authentication-strategy)
7. [Tech Stack](#7-tech-stack)

---

# 1. Product Requirements Document (PRD)

## 1.1 Background & Problem Statement

PT Mahkota Putra Logistik is a logistics company based in East Jakarta, providing domestic inter-island shipping, last-mile local delivery, and warehousing & storage services across Indonesia. As a company entering the digitalization phase, all operational data is currently managed manually — likely through paper records or spreadsheets.

This creates the following problems:
- No single source of truth for shipment status, client data, or invoices
- High risk of human error across departments (Ops, Finance, CS)
- No visibility for management across operations
- Difficulty scaling as order volume grows

## 1.2 Objective

Build a **web-based admin dashboard** that serves as the company's first centralized digital operations hub — designed around **manual data entry** by staff, with a clean, role-separated interface.

## 1.3 Goals

| Goal | Metric |
|---|---|
| Centralize shipment data | 100% of new shipments logged in the system |
| Reduce invoice lookup time | From ~15 min to under 2 min |
| Give management real-time overview | Dashboard shows live status of all active shipments |
| Role clarity | Each staff member only sees what's relevant to their role |

## 1.4 Non-Goals (Out of Scope for v1)

- Real-time GPS tracking of drivers
- Customer-facing portal (clients cannot log in)
- Mobile app
- Automated document generation (e.g. Bill of Lading, custom forms)
- Third-party API integrations (e.g. Bea Cukai, Raja Ongkir)
- Payment gateway integration

> These are v2 candidates, not permanent exclusions.

## 1.5 Users & Roles

| Role | Bahasa Label | Access Summary |
|---|---|---|
| **Super Admin** | Super Admin | Full access: all modules, user management, system settings |
| **Operations / Dispatch** | Operasional | Manage shipments, assign drivers, update shipment status |
| **Finance** | Keuangan | Manage invoices, track payments, view financial reports |
| **Customer Service** | Layanan Pelanggan | Manage client data, view shipment status, handle inquiries log |

## 1.6 Core Modules (MVP)

### Module 1 — Shipment & Order Management
Manually create, update, and track shipment orders from pickup to delivery.

### Module 2 — Customer (Client) Management
Maintain a database of corporate clients with contact details and shipment history.

### Module 3 — Driver & Fleet Management
Register drivers, assign them to shipments, track availability.

### Module 4 — Invoicing & Payment Tracking
Create invoices per shipment, mark payment status, generate simple summaries.

### Module 5 — Dashboard Overview (Home)
High-level KPI cards and status summaries visible upon login.

### Module 6 — User & Role Management
Super Admin only — create accounts, assign roles, deactivate users.

## 1.7 Service Scope

The system must support the following service types:

| Code | Service | Bahasa |
|---|---|---|
| `DOM-INT` | Domestic Inter-Island Shipping | Pengiriman Antar Pulau |
| `DOM-LM` | Last-Mile / Local Delivery | Pengiriman Lokal |
| `WHS` | Warehousing & Storage | Pergudangan & Penyimpanan |

## 1.8 Language

All UI labels shall be **bilingual (Bahasa Indonesia + English)**, with Bahasa Indonesia as the primary display language. English translations shown as subtitles or tooltips.

## 1.9 Platform

Web application — optimized for desktop browser (Chrome, Firefox). Minimum screen width: 1280px.

## 1.10 Success Metrics (3 months post-launch)

- ≥ 80% of shipments are being logged digitally
- Staff can retrieve any client or invoice record in under 2 minutes
- Zero reported data loss vs. paper records
- All 4 roles are actively using the system weekly

---

# 2. App Flow

## 2.1 Authentication Flow

> **Strategy:** Admin-Created Accounts + Forced Password Reset on First Login (v1)
> No public registration page exists. All accounts are provisioned by Super Admin only.

```
[ Super Admin creates user in dashboard ]
    │  (sets name, email, role, temp password)
    │
    └──→ [ New User opens Login Page ]
              │
              ├── Enter Email + Temp Password
              │
              ├── [Invalid] → Show error → Stay on Login
              │
              └── [Valid — First Login Detected]
                        │
                        └──→ [ Forced Password Change Screen ]
                                  │
                                  ├── { New Password }
                                  ├── { Confirm Password }
                                  │
                                  └──→ [ Password Saved ] → Detect Role
                                                │
                                                ├── Super Admin      → Full Dashboard
                                                ├── Operasional      → Shipment Dashboard
                                                ├── Keuangan         → Finance Dashboard
                                                └── Layanan Pelanggan → Client Dashboard

[ Returning User — Login Page ]
    │
    ├── Enter Email + Password
    ├── [Invalid, ≥5 attempts] → Account temporarily locked (15 min)
    └── [Valid] → Detect Role → Redirect to Role Dashboard
                      │
                      └── Session expires after 8 hours inactivity → Back to Login
```

## 2.2 Super Admin Flow

```
[ Dashboard Home ]
    │
    ├── Overview KPIs (Active Shipments, Pending Invoices, Registered Clients, Available Drivers)
    │
    ├── [ Manajemen Pengiriman / Shipment Management ]
    │       ├── List All Shipments → Filter by Status / Service / Date
    │       ├── + Buat Pengiriman Baru (Create New Shipment)
    │       │       └── Fill Form → Assign Driver → Save → Status: "Pending"
    │       ├── View Shipment Detail → Edit → Update Status
    │       └── Delete Shipment (Super Admin only)
    │
    ├── [ Manajemen Klien / Client Management ]
    │       ├── List All Clients → Search by Name / Company
    │       ├── + Tambah Klien (Add Client)
    │       │       └── Fill Form → Save
    │       ├── View Client Detail → Shipment History
    │       └── Edit / Deactivate Client
    │
    ├── [ Manajemen Driver & Armada / Driver & Fleet ]
    │       ├── List All Drivers → Filter by Availability
    │       ├── + Tambah Driver (Add Driver)
    │       │       └── Fill Form → Assign Vehicle → Save
    │       ├── View Driver Detail → Shipment Assignment History
    │       └── Edit / Deactivate Driver
    │
    ├── [ Faktur & Pembayaran / Invoice & Payment ]
    │       ├── List All Invoices → Filter by Status (Paid / Unpaid / Overdue)
    │       ├── + Buat Faktur (Create Invoice)
    │       │       └── Select Shipment → Auto-fill Client → Set Amount → Save
    │       ├── View Invoice Detail → Mark as Paid → Add Payment Notes
    │       └── Financial Summary View (total paid, total outstanding)
    │
    └── [ Manajemen Pengguna / User Management ]  ← Super Admin Only
            ├── List All Users
            ├── + Tambah Pengguna (Add User)
            │       └── Fill Name, Email, Password, Role → Save
            ├── Edit User / Reset Password
            └── Deactivate User
```

## 2.3 Operasional (Ops/Dispatch) Flow

```
[ Dashboard Home ] — Shipment-focused KPIs
    │
    ├── [ Manajemen Pengiriman ]
    │       ├── View All Shipments → Filter & Search
    │       ├── Create New Shipment → Assign Driver → Save
    │       └── Update Shipment Status (Pending → In Transit → Delivered → Cancelled)
    │
    └── [ Driver & Armada ]
            ├── View All Drivers & Availability
            └── View Driver Detail (read-only for fleet data)
```

## 2.4 Keuangan (Finance) Flow

```
[ Dashboard Home ] — Finance-focused KPIs
    │
    └── [ Faktur & Pembayaran ]
            ├── View All Invoices → Filter by Status / Date / Client
            ├── Create New Invoice (linked to existing shipment)
            ├── View Invoice Detail
            ├── Mark Invoice as Paid → Add Payment Date & Notes
            └── Financial Summary (monthly totals, outstanding balance)
```

## 2.5 Layanan Pelanggan (Customer Service) Flow

```
[ Dashboard Home ] — Client-focused KPIs
    │
    ├── [ Manajemen Klien ]
    │       ├── View & Search All Clients
    │       ├── Add / Edit Client
    │       └── View Client Shipment History (read-only)
    │
    └── [ Manajemen Pengiriman ]
            ├── View All Shipments (read-only)
            └── View Shipment Detail (read-only)
```

## 2.6 Global Shipment Status Flow

```
[ Pending / Menunggu ]
    └── → [ Diproses / Processing ]
              └── → [ Dalam Perjalanan / In Transit ]
                        ├── → [ Terkirim / Delivered ]  ✅
                        └── → [ Dibatalkan / Cancelled ] ❌
```

---

# 3. Low-Fidelity Wireframes

> Convention: `[ ]` = button, `{ }` = input field, `| |` = container/card, `---` = divider

---

## 3.1 Login Page

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│          🏢  MAHKOTA PUTRA LOGISTIK                      │
│              Admin Dashboard                             │
│                                                          │
│  ┌────────────────────────────────────────────────┐      │
│  │  { Email Address / Alamat Email             }  │      │
│  └────────────────────────────────────────────────┘      │
│  ┌────────────────────────────────────────────────┐      │
│  │  { Password / Kata Sandi                    }  │      │
│  └────────────────────────────────────────────────┘      │
│                                                          │
│         [ Masuk / Login                        ]         │
│                                                          │
│         Lupa kata sandi? / Forgot password?              │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## 3.2 Dashboard Home (All Roles)

```
┌─────────────────────────────────────────────────────────────────────┐
│  🏢 Mahkota Putra Logistik   │  🔔  │  👤 Nama Admin ▾  │  [Keluar]  │
├──────────────┬──────────────────────────────────────────────────────┤
│              │                                                       │
│  NAVIGASI    │  Selamat Datang, [Nama]  —  [Role Label]             │
│  ─────────   │  ───────────────────────────────────────────────     │
│  🏠 Beranda  │                                                       │
│              │  | Pengiriman Aktif  |  | Faktur Belum Lunas |       │
│  📦 Pengiriman│  |    24            |  |    7               |       │
│              │  | Active Shipments  |  | Unpaid Invoices     |       │
│  👥 Klien    │                                                       │
│              │  | Total Klien      |  | Driver Tersedia     |       │
│  🚛 Driver   │  |    58            |  |    12              |       │
│              │  | Total Clients    |  | Available Drivers   |       │
│  🧾 Faktur   │                                                       │
│              │  ─────────────────────────────────────────────────   │
│  ⚙️ Pengguna │                                                       │
│  (Super Admin│  Pengiriman Terbaru / Recent Shipments               │
│   only)      │  ┌────────────────────────────────────────────────┐  │
│              │  │ ID  │ Klien   │ Tujuan  │ Status  │ Tanggal   │  │
│              │  │─────│─────────│─────────│─────────│───────────│  │
│              │  │ 001 │ PT ABC  │ Surabaya│ Transit │ 20 Apr    │  │
│              │  │ 002 │ CV XYZ  │ Medan   │ Pending │ 19 Apr    │  │
│              │  │ 003 │ PT DEF  │ Bali    │Terkirim │ 18 Apr    │  │
│              │  └────────────────────────────────────────────────┘  │
│              │                    [ Lihat Semua / View All ]        │
└──────────────┴───────────────────────────────────────────────────────┘
```

---

## 3.3 Shipment List Page

```
┌─────────────────────────────────────────────────────────────────────┐
│  Manajemen Pengiriman / Shipment Management                         │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                     │
│  { 🔍 Cari pengiriman... / Search shipments... }                    │
│                                                                     │
│  Filter:  [ Semua Status ▾ ]  [ Semua Layanan ▾ ]  [ Tanggal ▾ ]  │
│                                              [ + Buat Baru / New ]  │
│  ─────────────────────────────────────────────────────────────────  │
│  │ No. │ ID Order │ Klien       │ Layanan  │ Tujuan   │ Status  │ ▶ │
│  │─────│──────────│─────────────│──────────│──────────│─────────│───│
│  │  1  │ MPL-0041 │ PT Sinar    │ Antar    │ Surabaya │ 🟡 Transit│ │
│  │     │          │ Jaya        │ Pulau    │          │         │   │
│  │─────│──────────│─────────────│──────────│──────────│─────────│───│
│  │  2  │ MPL-0040 │ CV Maju     │ Lokal    │ Bekasi   │ 🟢 Terkirim│ │
│  │─────│──────────│─────────────│──────────│──────────│─────────│───│
│  │  3  │ MPL-0039 │ PT Nusantara│ Gudang   │ Jakarta  │ 🔵 Aktif │ │
│  ─────────────────────────────────────────────────────────────────  │
│  Menampilkan 1-20 dari 124  |  [ < Prev ]  Hal. 1  [ Next > ]      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3.4 Create / Edit Shipment Form

```
┌─────────────────────────────────────────────────────────────────────┐
│  Buat Pengiriman Baru / Create New Shipment                         │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                     │
│  INFORMASI PENGIRIMAN / SHIPMENT INFORMATION                        │
│  { Pilih Klien / Select Client ▾                               }   │
│  { Jenis Layanan / Service Type ▾  (Antar Pulau/Lokal/Gudang) }   │
│  { Kota Asal / Origin City                                     }   │
│  { Kota Tujuan / Destination City                              }   │
│  { Tanggal Pickup / Pickup Date  📅                            }   │
│  { Estimasi Tiba / Estimated Arrival  📅                       }   │
│                                                                     │
│  DETAIL MUATAN / CARGO DETAILS                                      │
│  { Deskripsi Barang / Cargo Description                        }   │
│  { Berat (kg) / Weight (kg)   }   { Volume (m³) / Volume (m³) }   │
│  { Jumlah Koli / Number of Packages                            }   │
│                                                                     │
│  PENUGASAN / ASSIGNMENT                                             │
│  { Pilih Driver / Assign Driver ▾                              }   │
│  { Nomor Kendaraan / Vehicle Plate No.                         }   │
│                                                                     │
│  CATATAN / NOTES                                                    │
│  { Catatan Tambahan / Additional Notes                         }   │
│  { (textarea, 4 rows)                                          }   │
│                                                                     │
│  [ Batal / Cancel ]                      [ Simpan / Save Order ]   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3.5 Shipment Detail Page

```
┌─────────────────────────────────────────────────────────────────────┐
│  ← Kembali   Detail Pengiriman / Shipment Detail  #MPL-0041         │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                     │
│  STATUS:  🟡 Dalam Perjalanan / In Transit                          │
│  [ Update Status ▾ ]    [ Edit ]    [ Cetak / Print ]               │
│                                                                     │
│  ┌──────────────────────────┐  ┌──────────────────────────────┐     │
│  │ INFORMASI KLIEN          │  │ RUTE PENGIRIMAN              │     │
│  │ PT Sinar Jaya            │  │ Asal:    Jakarta Timur       │     │
│  │ Kontak: Budi Santoso     │  │ Tujuan:  Surabaya            │     │
│  │ Telp: 0812-xxx-xxxx      │  │ Pickup:  18 Apr 2026         │     │
│  │ Email: budi@sinar.co.id  │  │ Est. Tiba: 21 Apr 2026       │     │
│  └──────────────────────────┘  └──────────────────────────────┘     │
│                                                                     │
│  ┌──────────────────────────┐  ┌──────────────────────────────┐     │
│  │ DETAIL MUATAN            │  │ DRIVER & KENDARAAN           │     │
│  │ Deskripsi: Elektronik    │  │ Driver: Ahmad Fauzi          │     │
│  │ Berat: 450 kg            │  │ Telp: 0813-xxx-xxxx          │     │
│  │ Volume: 2.4 m³           │  │ Kendaraan: Toyota Dyna       │     │
│  │ Koli: 12 karton          │  │ No. Plat: B 1234 XY          │     │
│  └──────────────────────────┘  └──────────────────────────────┘     │
│                                                                     │
│  RIWAYAT STATUS / STATUS HISTORY                                    │
│  ● 20 Apr 09:00  →  Dalam Perjalanan  (oleh: Rudi - Ops)           │
│  ● 18 Apr 14:00  →  Diproses          (oleh: Rudi - Ops)           │
│  ● 18 Apr 10:00  →  Pending           (oleh: Sari - CS)            │
│                                                                     │
│  CATATAN / NOTES                                                    │
│  "Barang fragile, harap hati-hati saat bongkar muat."               │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3.6 Client Management Page

```
┌─────────────────────────────────────────────────────────────────────┐
│  Manajemen Klien / Client Management                                │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                     │
│  { 🔍 Cari nama / perusahaan... / Search by name / company }        │
│                                          [ + Tambah Klien / Add ]   │
│                                                                     │
│  │ Nama Perusahaan     │ PIC         │ Telepon       │ Aktif  │ ▶  │
│  │─────────────────────│─────────────│───────────────│────────│────│
│  │ PT Sinar Jaya       │ Budi S.     │ 0812-xxx-xxxx │ ✅ Ya  │ →  │
│  │ CV Maju Bersama     │ Dewi A.     │ 0813-xxx-xxxx │ ✅ Ya  │ →  │
│  │ PT Nusantara Lestari│ Hendra W.   │ 0811-xxx-xxxx │ ❌ Tidak│ →  │
│  ─────────────────────────────────────────────────────────────────  │
│  Menampilkan 1-20 dari 58 klien                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3.7 Invoice List & Detail

```
┌─────────────────────────────────────────────────────────────────────┐
│  Faktur & Pembayaran / Invoices & Payments                          │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                     │
│  RINGKASAN / SUMMARY                                                │
│  | Total Tagihan        |  | Sudah Dibayar   |  | Belum Dibayar |  │
│  | Rp 128.400.000       |  | Rp 94.200.000   |  | Rp 34.200.000 |  │
│                                                                     │
│  Filter: [ Semua ▾ ]  [ Bulan ini ▾ ]     [ + Buat Faktur / New ]  │
│                                                                     │
│  │ No. Faktur │ Klien        │ Jumlah       │ Status    │ Jatuh Tempo│
│  │────────────│──────────────│──────────────│───────────│────────────│
│  │ INV-0091   │ PT Sinar Jaya│ Rp 4.500.000 │ 🔴 Lewat  │ 15 Apr    │
│  │ INV-0090   │ CV Maju      │ Rp 2.200.000 │ 🟡 Belum  │ 25 Apr    │
│  │ INV-0089   │ PT Nusantara │ Rp 6.800.000 │ 🟢 Lunas  │ 10 Apr    │
│  ─────────────────────────────────────────────────────────────────  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3.8 Driver & Fleet Management

```
┌─────────────────────────────────────────────────────────────────────┐
│  Driver & Armada / Driver & Fleet Management                        │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                     │
│  { 🔍 Cari nama driver... }        Filter: [ Semua Status ▾ ]      │
│                                          [ + Tambah Driver / Add ]  │
│                                                                     │
│  │ Nama Driver   │ No. Kendaraan │ Jenis    │ Status       │ ▶     │
│  │───────────────│───────────────│──────────│──────────────│───────│
│  │ Ahmad Fauzi   │ B 1234 XY     │ Truk Box │ 🟡 Bertugas  │  →   │
│  │ Budi Santoso  │ B 5678 AB     │ Pickup   │ 🟢 Tersedia  │  →   │
│  │ Candra Wijaya │ B 9012 CD     │ Truk Box │ 🔴 Tidak Aktif│  →  │
│  ─────────────────────────────────────────────────────────────────  │
│  12 Driver Aktif  |  3 Driver Bertugas  |  9 Driver Tersedia        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3.9 User Management (Super Admin Only)

```
┌─────────────────────────────────────────────────────────────────────┐
│  Manajemen Pengguna / User Management                               │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                     │
│                                    [ + Tambah Pengguna / Add User ] │
│                                                                     │
│  │ Nama           │ Email              │ Role         │ Aktif │ ⚙  │
│  │────────────────│────────────────────│──────────────│───────│────│
│  │ Rudi Hartono   │ rudi@mahkota.id    │ Operasional  │ ✅    │ ✏  │
│  │ Sari Dewi      │ sari@mahkota.id    │ Layanan Pelanggan│ ✅ │ ✏  │
│  │ Hendra Keuangan│ hendra@mahkota.id  │ Keuangan     │ ✅    │ ✏  │
│  │ Admin Utama    │ admin@mahkota.id   │ Super Admin  │ ✅    │ ✏  │
│  ─────────────────────────────────────────────────────────────────  │
└─────────────────────────────────────────────────────────────────────┘
```

---

# 4. Database Schema

> Design philosophy: Simple, normalized, manual-entry friendly. No automation dependencies.

---

## 4.1 Entity Relationship Overview

```
users ──────────────────────── roles
  │                               │
  ├── created shipments ──────────┤
  └── status_logs                 │
                                  │
clients ──────────── shipments ───┤
                          │       │
                          ├── invoices
                          │
                    drivers + vehicles
```

---

## 4.2 Table: `users`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | Auto-generated |
| `name` | VARCHAR(100) | Full name |
| `email` | VARCHAR(150) | Unique, used for login |
| `password_hash` | VARCHAR(255) | bcrypt hashed |
| `role` | ENUM | `super_admin`, `ops`, `finance`, `cs` |
| `is_first_login` | BOOLEAN | Default: true — triggers forced password reset |
| `temp_password_hash` | VARCHAR(255) | Cleared after first login |
| `failed_login_attempts` | INT | Default: 0 — resets on success |
| `locked_until` | TIMESTAMP | Nullable — set after 5 failed attempts |
| `last_login_at` | TIMESTAMP | Nullable |
| `last_login_ip` | VARCHAR(45) | For audit trail |
| `is_active` | BOOLEAN | Default: true |
| `created_by` | UUID FK → users.id | Which admin created this account |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |

---

## 4.3 Table: `clients`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `company_name` | VARCHAR(150) | e.g. PT Sinar Jaya |
| `pic_name` | VARCHAR(100) | Person in charge |
| `phone` | VARCHAR(20) | |
| `email` | VARCHAR(150) | |
| `address` | TEXT | |
| `city` | VARCHAR(100) | |
| `npwp` | VARCHAR(30) | Tax ID — optional |
| `is_active` | BOOLEAN | Default: true |
| `notes` | TEXT | Internal notes |
| `created_by` | UUID FK → users.id | |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |

---

## 4.4 Table: `drivers`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `name` | VARCHAR(100) | |
| `phone` | VARCHAR(20) | |
| `license_number` | VARCHAR(50) | Nomor SIM |
| `license_expiry` | DATE | |
| `vehicle_type` | VARCHAR(50) | e.g. Truk Box, Pickup |
| `vehicle_plate` | VARCHAR(20) | e.g. B 1234 XY |
| `status` | ENUM | `available`, `on_duty`, `inactive` |
| `is_active` | BOOLEAN | Default: true |
| `notes` | TEXT | |
| `created_by` | UUID FK → users.id | |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |

---

## 4.5 Table: `shipments`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `order_number` | VARCHAR(20) | e.g. MPL-0041, auto-generated |
| `client_id` | UUID FK → clients.id | |
| `service_type` | ENUM | `inter_island`, `last_mile`, `warehousing` |
| `origin_city` | VARCHAR(100) | |
| `destination_city` | VARCHAR(100) | |
| `pickup_date` | DATE | |
| `estimated_arrival` | DATE | |
| `actual_arrival` | DATE | Filled when delivered |
| `cargo_description` | TEXT | |
| `weight_kg` | DECIMAL(10,2) | |
| `volume_m3` | DECIMAL(10,2) | |
| `package_count` | INT | |
| `driver_id` | UUID FK → drivers.id | Nullable |
| `status` | ENUM | `pending`, `processing`, `in_transit`, `delivered`, `cancelled` |
| `notes` | TEXT | |
| `created_by` | UUID FK → users.id | |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |

---

## 4.6 Table: `shipment_status_logs`

Tracks every status change for audit trail.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `shipment_id` | UUID FK → shipments.id | |
| `old_status` | ENUM | Previous status |
| `new_status` | ENUM | New status |
| `changed_by` | UUID FK → users.id | |
| `notes` | TEXT | Optional change note |
| `changed_at` | TIMESTAMP | |

---

## 4.7 Table: `invoices`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `invoice_number` | VARCHAR(20) | e.g. INV-0091 |
| `shipment_id` | UUID FK → shipments.id | |
| `client_id` | UUID FK → clients.id | Denormalized for speed |
| `amount` | DECIMAL(15,2) | In IDR |
| `tax_amount` | DECIMAL(15,2) | PPN (optional v1) |
| `total_amount` | DECIMAL(15,2) | amount + tax |
| `due_date` | DATE | |
| `payment_status` | ENUM | `unpaid`, `paid`, `overdue` |
| `paid_at` | TIMESTAMP | Nullable — filled when paid |
| `payment_notes` | TEXT | e.g. "Transfer BCA xxxxxxx" |
| `created_by` | UUID FK → users.id | |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |

---

## 4.8 Table: `warehousing_records` *(v1 — simple)*

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `client_id` | UUID FK → clients.id | |
| `shipment_id` | UUID FK → shipments.id | Nullable |
| `item_description` | TEXT | |
| `quantity` | INT | |
| `unit` | VARCHAR(30) | e.g. karton, palet, unit |
| `storage_location` | VARCHAR(100) | e.g. Rak A-3 |
| `date_in` | DATE | |
| `date_out` | DATE | Nullable |
| `status` | ENUM | `stored`, `released` |
| `notes` | TEXT | |
| `created_by` | UUID FK → users.id | |
| `created_at` | TIMESTAMP | |

---

## 4.9 Role Permission Matrix

| Feature | Super Admin | Ops | Finance | CS |
|---|---|---|---|---|
| View Dashboard | ✅ | ✅ | ✅ | ✅ |
| Create Shipment | ✅ | ✅ | ❌ | ❌ |
| Edit Shipment | ✅ | ✅ | ❌ | ❌ |
| Delete Shipment | ✅ | ❌ | ❌ | ❌ |
| View Shipment | ✅ | ✅ | ✅ | ✅ |
| Update Status | ✅ | ✅ | ❌ | ❌ |
| Create/Edit Client | ✅ | ❌ | ❌ | ✅ |
| View Client | ✅ | ✅ | ✅ | ✅ |
| Create/Edit Driver | ✅ | ✅ | ❌ | ❌ |
| View Driver | ✅ | ✅ | ❌ | ❌ |
| Create Invoice | ✅ | ❌ | ✅ | ❌ |
| Mark Invoice Paid | ✅ | ❌ | ✅ | ❌ |
| View Invoice | ✅ | ❌ | ✅ | ❌ |
| User Management | ✅ | ❌ | ❌ | ❌ |
| Warehousing Records | ✅ | ✅ | ❌ | ✅ |

---

# 5. Open Decisions & Next Steps

## 5.1 Open Decisions `[OPEN DECISION]`

| # | Decision | Options | Impact |
|---|---|---|---|
| OD-01 | Auto-generate order numbers (MPL-xxxx)? | Auto-increment vs. Manual input | DB + UX |
| OD-02 | Should Finance see shipment list (read-only)? | Yes / No | Role matrix |
| OD-03 | PPN/Tax on invoices — include in v1? | Yes (11%) / No / Optional field | Invoice module |
| OD-04 | Does existing Excel data need to be imported? | Yes (migration needed) / Start fresh | DB + launch timeline |
| OD-05 | One vehicle per driver, or drivers can switch vehicles? | 1:1 Fixed / Many:Many flexible | Driver & Fleet schema |
| OD-06 | Password reset — Super Admin resets manually (v1) or add forgot-password email flow? | Manual reset / Email SMTP | Auth module |
| OD-07 | Warehousing — track per-item in/out? Or just per-client summary? | Detailed / Summary | `warehousing_records` complexity |

---

## 5.2 Recommended Next Step 🔭

**MoSCoW Feature Prioritization Matrix**

Now that the full scope is defined, the next step is to run a **MoSCoW exercise** on all modules to separate:

- 🔴 **Must Have** → Launch blockers (Shipment CRUD, Login, Role Access)
- 🟡 **Should Have** → High value, but not day-1 (Invoice module, Driver assignment)
- 🟢 **Could Have** → Nice extras (Audit log, Export to Excel, Notifications)
- ⚫ **Won't Have (v1)** → GPS tracking, Client portal, API integrations

This will directly feed into your **developer sprint plan** and give you a realistic **v1 go-live date estimate**.

---

# 6. Authentication Strategy

## 6.1 Chosen Strategy: Admin-Created Accounts + Forced Password Reset

### Why This Was Chosen

| Criteria | Decision |
|---|---|
| Company stage | New to digitalization — no email infrastructure confirmed |
| Team size | Small (≤ 10 internal staff) |
| Risk tolerance | Internal B2B tool — no public-facing access |
| Speed to launch | Fastest to implement, zero external dependencies |
| WhatsApp culture | Temp passwords can be shared securely over WA |

### What This Means in Practice

1. **No registration page exists** — the URL `/register` returns 404 or redirects to login
2. **Super Admin creates all accounts** via the User Management module
3. Super Admin sets a temporary password (e.g. `Mahkota2026!`) and shares it with the new user via WhatsApp
4. On first login, the system detects `is_first_login = true` and **forces a password change** before proceeding
5. After password change, `is_first_login` is set to `false` and `temp_password_hash` is cleared
6. If a user forgets their password, they contact the Super Admin who resets it manually

---

## 6.2 Authentication Flow (Detailed)

```
┌─────────────────────────────────────────────────────────┐
│                 SUPER ADMIN PROVISIONS USER              │
│                                                         │
│  Dashboard → User Management → + Tambah Pengguna        │
│  Fills: Name, Email, Role                               │
│  System generates or admin sets temp password           │
│  is_first_login = TRUE                                  │
│  Admin shares credentials via WhatsApp                  │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│                    LOGIN PAGE                           │
│                 /login  (only public page)              │
│                                                         │
│  { Email }                                              │
│  { Password }                                           │
│  [ Masuk / Login ]                                      │
│                                                         │
│  ❌ No "Register" link                                  │
│  ❌ No "Sign in with Google" (v1)                       │
│  ✅ "Lupa Kata Sandi?" → "Hubungi Admin"                │
└───────────────────────┬─────────────────────────────────┘
                        │
           ┌────────────┴────────────┐
           ▼                         ▼
    [ Credentials              [ Credentials
       Invalid ]                  Valid ]
           │                         │
    Show error msg           Check is_first_login
    +1 failed_login_attempts         │
           │                ┌────────┴────────┐
    [≥5 attempts]           ▼                 ▼
    Lock 15 minutes    [ TRUE ]           [ FALSE ]
                            │                 │
                     Redirect to        Redirect to
                     /change-password   Role Dashboard
                            │
                     { New Password }
                     { Confirm Password }
                     [ Simpan / Save ]
                            │
                     is_first_login = false
                     temp_password cleared
                            │
                     Redirect to Role Dashboard
```

---

## 6.3 Session Management

| Setting | Value | Reason |
|---|---|---|
| Session type | JWT (stateless) or server-side session | `[OPEN DECISION]` — depends on backend choice |
| Token expiry | 8 hours | Matches a full work shift |
| Inactivity timeout | 30 minutes of no API calls | Security for unattended desktops |
| Remember me | ❌ Not in v1 | Internal tool — always on company device |
| Concurrent sessions | 1 active session per user | Prevents sharing credentials |

---

## 6.4 Security Checklist (Non-Negotiable)

- [x] HTTPS enforced — HTTP redirects to HTTPS, no mixed content
- [x] Passwords hashed with `bcrypt` (cost factor ≥ 12)
- [x] Rate limiting — 5 failed attempts → 15-minute lockout
- [x] Session expires after 8h / 30min inactivity
- [x] Role check on **every API endpoint**, not just frontend routes
- [x] `is_first_login` flag — forces password reset before any access
- [x] Login IP logged in `last_login_ip` for audit trail
- [x] No password in plaintext anywhere — not in logs, not in emails
- [x] CORS configured — only allow requests from the admin frontend domain
- [ ] 2FA via WhatsApp OTP — **v2 roadmap**
- [ ] Magic link / email invite — **v2 roadmap**
- [ ] Google SSO (requires Google Workspace `@mahkotaputralogistik.id`) — **v2 roadmap**

---

## 6.5 Login Page Wireframe (Updated)

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│          🏢  MAHKOTA PUTRA LOGISTIK                      │
│          Admin Dashboard  |  Panel Administrasi          │
│                                                          │
│  ┌────────────────────────────────────────────────┐      │
│  │  { Email                                    }  │      │
│  └────────────────────────────────────────────────┘      │
│  ┌────────────────────────────────────────────────┐      │
│  │  { Kata Sandi / Password              👁       }│      │
│  └────────────────────────────────────────────────┘      │
│                                                          │
│  ⚠️  [Error: Email atau kata sandi salah]  ← conditional │
│                                                          │
│         [ Masuk / Login                        ]         │
│                                                          │
│   Lupa kata sandi? Hubungi Super Admin Anda.            │
│   Forgot password? Contact your Super Admin.            │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

```
┌──────────────────────────────────────────────────────────┐
│          Buat Kata Sandi Baru / Set New Password         │
│          Ini adalah login pertama Anda.                  │
│          This is your first login.                       │
│                                                          │
│  ┌────────────────────────────────────────────────┐      │
│  │  { Kata Sandi Baru / New Password     👁       }│      │
│  └────────────────────────────────────────────────┘      │
│  ┌────────────────────────────────────────────────┐      │
│  │  { Konfirmasi Kata Sandi / Confirm    👁       }│      │
│  └────────────────────────────────────────────────┘      │
│                                                          │
│  ✅ Min. 8 karakter                                      │
│  ✅ Kombinasi huruf & angka                              │
│                                                          │
│         [ Simpan & Masuk / Save & Login        ]         │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## 6.6 Upgrade Path (v2 Roadmap)

```
v1 — Now (Manual)
  Admin creates account → shares temp password via WhatsApp
  User forced to change password on first login

v2 — Option A: Magic Link (Recommended upgrade)
  Admin creates account → system sends email with one-time link
  User clicks link → directly lands on set-password screen
  Requires: SMTP setup (Resend.com / Sendgrid — ~$0 for small volume)

v2 — Option B: Google SSO
  Admin creates account with @mahkotaputralogistik.id Google email
  User clicks "Masuk dengan Google"
  Google handles 2FA, password management
  Requires: Google Workspace subscription + OAuth2 setup
```

---

# 7. Tech Stack

## 7.1 Confirmed Frontend Stack

| Layer | Technology | Notes |
|---|---|---|
| **Framework** | React + Vite | Fast HMR, modern build tooling |
| **Language** | JSX | Component-based UI |
| **Architecture** | Monorepo with shared UI library | Shared components across potential future apps |
| **Routing** | React Router v6 | Client-side routing, role-based guards |
| **State Management** | Zustand *(recommended)* | Lightweight, simple for auth state + role |
| **HTTP Client** | Axios *(recommended)* | Interceptors for auth token injection |
| **Form Handling** | React Hook Form *(recommended)* | Low re-render, easy validation |
| **UI Components** | Shadcn/ui or Ant Design *(recommended)* | Both have bilingual support potential |
| **Styling** | Tailwind CSS *(recommended)* | Works well with monorepo shared UI |

### Monorepo Structure Recommendation

```
mahkota-admin/
├── apps/
│   └── admin/                  ← Main admin dashboard app (React Vite)
│       ├── src/
│       │   ├── pages/
│       │   │   ├── auth/       ← Login, ChangePassword
│       │   │   ├── dashboard/  ← Home overview
│       │   │   ├── shipments/  ← List, Detail, Create, Edit
│       │   │   ├── clients/
│       │   │   ├── drivers/
│       │   │   ├── invoices/
│       │   │   └── users/      ← Super Admin only
│       │   ├── components/     ← Page-specific components
│       │   ├── hooks/          ← useAuth, useRole, useShipments
│       │   ├── stores/         ← Zustand stores
│       │   └── utils/          ← formatIDR, formatDate, etc.
│       └── vite.config.js
│
└── packages/
    └── ui/                     ← Shared monorepo UI library
        ├── Button/
        ├── Table/
        ├── Badge/ (for status chips)
        ├── Modal/
        ├── FormInput/
        └── index.js
```

---

## 7.2 Backend — Under Consideration `[OPEN DECISION]`

Since the backend is still being decided, here are the top 3 recommendations ranked by fit for this project:

### 🥇 Option A — Laravel (PHP) *(Recommended for Indonesia context)*

| | |
|---|---|
| **Why** | Most widely used backend in Indonesia — easiest to hire for |
| **Auth** | Laravel Sanctum (SPA token auth) — perfect for React + API setup |
| **ORM** | Eloquent — clean, readable, fast to build |
| **Migration** | Built-in migration system — great for evolving schema |
| **Hosting** | Cheap Indonesian VPS (Niagahoster, IDCloudHost, Rumahweb) |
| **Skill availability** | ⭐⭐⭐⭐⭐ in Indonesian dev market |
| **API pattern** | REST (recommended for v1 simplicity) |

```
Stack: React Vite JSX + Laravel 11 + MySQL + Laravel Sanctum
```

---

### 🥈 Option B — Node.js + Express (or Fastify)

| | |
|---|---|
| **Why** | Same language as frontend (JS/TS) — smaller context switch |
| **Auth** | JWT with `jsonwebtoken` + `bcrypt` |
| **ORM** | Prisma — excellent TypeScript support, clean schema |
| **Hosting** | Railway, Render, or VPS |
| **Skill availability** | ⭐⭐⭐⭐ in Indonesian dev market |
| **API pattern** | REST or tRPC if going full TypeScript |

```
Stack: React Vite JSX + Node.js Express + PostgreSQL + Prisma + JWT
```

---

### 🥉 Option C — Supabase (BaaS) *(Fastest to v1)*

| | |
|---|---|
| **Why** | Instant REST & realtime API from your DB schema — almost no backend code |
| **Auth** | Supabase Auth built-in — handles sessions, RLS (row-level security) |
| **DB** | PostgreSQL hosted by Supabase |
| **Trade-off** | Less control, vendor dependency, complex RLS for 4 roles |
| **Hosting** | Supabase cloud (free tier available) |
| **Best for** | Solo developer or very tight timeline |

```
Stack: React Vite JSX + Supabase (Auth + DB + REST API)
```

---

## 7.3 Stack Decision Matrix

| Criteria | Laravel | Node.js + Express | Supabase |
|---|---|---|---|
| Hire local devs easily | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| Speed to v1 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Control & flexibility | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| Auth complexity (4 roles) | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| Long-term scalability | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| Local hosting (VPS ID) | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ |
| Monorepo compatibility | ✅ | ✅ | ✅ |

> **Recommendation:** If you're hiring an Indonesian developer → **Laravel**. If you or your dev is a JS/TS person → **Node.js + Express with Prisma**. If you need to launch in under 4 weeks alone → **Supabase**.

---

## 7.4 Auth Implementation by Backend Choice

### If Laravel (Recommended)
```
Frontend (React) → POST /api/auth/login → Laravel Sanctum
                                             ↓
                                      Returns: Bearer Token
                                             ↓
Frontend stores token → Axios Authorization header on all requests
                                             ↓
                              Every API route: auth:sanctum middleware
                              + custom role middleware (CheckRole)
```

### If Node.js + Express
```
Frontend (React) → POST /api/auth/login → Express route
                                             ↓
                                   bcrypt.compare(password, hash)
                                             ↓
                                   jwt.sign({ id, role }, SECRET)
                                             ↓
                              Returns: JWT token (httpOnly cookie or
                              localStorage — cookie recommended)
                                             ↓
                         Middleware: verifyToken + requireRole(['ops'])
```

### If Supabase
```
Frontend (React) → supabase.auth.signInWithPassword()
                                             ↓
                              Returns: session + user object
                                             ↓
                         Row Level Security policies enforce role access
                         at the database level
```

---

*Document prepared using Google Antigravity planning methodology.*
*All `[OPEN DECISION]` items require sign-off before development begins.*
*Version 1.1 — Authentication Strategy & Tech Stack added April 2026.*
