# PT Mahkota Putra Logistik (MPL) — Backend Integration Guide

Hello! This document outlines the backend and database changes required to support the frontend revisions made to the MPL Admin Dashboard. 

All frontend validation, forms, and polling logic (8-second auto-refresh) are fully implemented. Please update the Prisma schema, databases, validation schemas, and endpoints accordingly.

---

## 1. Drivers API (`/api/fleet/drivers`)

The driver forms now capture detailed driving license details.

### Database / Schema Updates (Prisma)
Add the following fields to the Driver model:
- `licenseNumber`: `String` (required)
- `licenseType`: `String` or `Enum` (Values: `"A"`, `"B1"`, `"B2"`, required)
- `licenseExpiry`: `DateTime` (required)

### API Endpoints
Update **`POST /api/fleet/drivers`** and **`PATCH /api/fleet/drivers/:id`** to accept, validate, and store:
```json
{
  "name": "...",
  "phone": "...",
  "licenseNumber": "1234567890",
  "licenseType": "B1",
  "licenseExpiry": "2029-06-30T00:00:00.000Z"
}
```

---

## 2. Armada / Vehicles API (`/api/fleet/vehicles`)

The fleet creation and modification forms now enforce STNK and KIR registration expiration checks.

### Database / Schema Updates (Prisma)
Add the following fields to the Vehicle/Armada model:
- `stnkExpiry`: `DateTime` (required)
- `kirExpiry`: `DateTime` (required)

### API Endpoints
Update **`POST /api/fleet/vehicles`** and **`PATCH /api/fleet/vehicles/:id`** to handle:
```json
{
  "plateNumber": "...",
  "type": "...",
  "stnkExpiry": "2027-12-15T00:00:00.000Z",
  "kirExpiry": "2026-11-20T00:00:00.000Z"
}
```

---

## 3. Shipments API (`/api/shipments` & `/api/shipments/:id/status`)

The shipment volume metric has been changed from weight ("Berat") to quantity ("Units / Pcs"), and price mirroring/ETA tracking have been added.

### Database / Schema Updates (Prisma)
Update or add fields in the Shipment model:
- Rename or map `weight` to `units` (Integer/Float, representing "Units / Pcs").
- Add `price`: `Decimal` / `Float` (representing "Harga / Invoice (Rp)").
- Add `estimatedArrival` / `eta`: `DateTime` (nullable, representing "Estimasi Tiba").
- Add `proofPhoto`: `String` (nullable, URL/filepath representing "Foto Bukti").

### API Endpoints
1. **`POST /api/shipments`** / **`PATCH /api/shipments/:id`**:
   Accept and store `units` and `price`.
   ```json
   {
     "origin": "...",
     "destination": "...",
     "units": 150,
     "price": 3500000
   }
   ```
2. **`PATCH /api/shipments/:id/status`**:
   In addition to standard status fields (e.g. `status`), accept updates for `estimatedArrival` and optionally `proofPhoto`:
   ```json
   {
     "status": "DELIVERED",
     "estimatedArrival": "2026-06-12T14:30:00.000Z",
     "proofPhoto": "/uploads/proofs/shipment-123.jpg"
   }
   ```

---

## 4. Invoices API (`/api/invoices`)

The frontend "Buat Faktur Baru" (Create Invoice) form now automatically fetches the selected shipment's price and sets the Invoice's Nominal field to be **read-only** (locked to the shipment's price).

### API Endpoints
- **`POST /api/invoices`**:
  Ensure that when an invoice is created for a shipment, the nominal amount matches the selected shipment's `price` field (or validate it server-side to prevent tampering).
  ```json
  {
    "shipmentId": "SHIP-XXXX",
    "nominal": 3500000,
    "dueDate": "2026-07-01T00:00:00.000Z"
  }
  ```

---

## 5. Users API (`/api/users`)

The client creation flow now supports a persistent success modal that displays credentials and generates magic links.

### API Endpoints
- **`POST /api/users`**:
  When creating a new user/client, the response body **must** return the auto-generated password and/or a magic login link so the admin can copy them.
  
  **Expected Response Structure:**
  ```json
  {
    "success": true,
    "user": {
      "id": "USR-123",
      "email": "client@example.com",
      "fullName": "John Doe",
      "role": "client"
    },
    "credentials": {
      "email": "client@example.com",
      "password": "GeneratedPassword123!"
    },
    "magicLink": "http://localhost:3000/magic-login?token=xyz123..."
  }
  ```

---

## 6. Real-Time / Polling Sync
The frontend implements an **8-second polling** trigger on all sections (`Clients`, `Drivers`, `Armada`, `Shipments`, `Invoices`, `Users`, and `Tracking`). You do not need to implement WebSockets; standard HTTP `GET` handlers with optimized queries/indexes will be sufficient to handle the periodic re-fetching load.
