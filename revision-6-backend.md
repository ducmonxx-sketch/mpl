# Revision 6: Backend API Specification for Admin Dashboard

This document details the backend requirements, database queries, and route registrations needed to support the UI updates introduced in the Revision 6 admin dashboard overhaul.

---

## 1. Route Path Resolution (Important Mismatch Notice)
Please review the endpoints below. The frontend code is currently configured to call `/api/admin/notifications`, but the Express server mounts the router at `/api/admin-notifications` inside `apps/api/src/index.ts`. 

> [!WARNING]
> Please align the route registration in the backend to match the frontend call structure:
> - Change `app.use("/api/admin-notifications", adminNotificationsRouter)` to `app.use("/api/admin/notifications", adminNotificationsRouter)` in [index.ts](file:///c:/Users/Biz/Documents/MPL%20Website%202%20-%20Edit/apps/api/src/index.ts).

---

## 2. Admin Notifications API Endpoints

The following routes are implemented in [adminNotifications.ts](file:///c:/Users/Biz/Documents/MPL%20Website%202%20-%20Edit/apps/api/src/routes/adminNotifications.ts) and need to be mounted correctly:

### A. List Admin Notifications
* **Endpoint:** `GET /api/admin/notifications`
* **Authentication:** Required (Admin Token with `authenticate` and `adminOnly` middleware)
* **Response `(200 OK)`:**
  ```json
  {
    "notifications": [
      {
        "id": "uuid-string",
        "title": "Notifikasi Judul",
        "message": "Detail pesan notifikasi.",
        "category": "driver | armada | invoice | system",
        "isRead": false,
        "linkTo": "drivers | armada | invoices | shipments",
        "linkId": "target-uuid-string",
        "createdAt": "2026-06-25T10:30:00Z"
      }
    ],
    "unreadCount": 1
  }
  ```

### B. Mark Single Notification as Read
* **Endpoint:** `PATCH /api/admin/notifications/:id/read`
* **Authentication:** Required (Admin Token)
* **Response `(200 OK)`:**
  ```json
  {
    "message": "Notification marked as read.",
    "notification": {
      "id": "uuid-string",
      "isRead": true
    }
  }
  ```

### C. Mark All Notifications as Read
* **Endpoint:** `PATCH /api/admin/notifications/read-all`
* **Authentication:** Required (Admin Token)
* **Response `(200 OK)`:**
  ```json
  {
    "message": "All notifications marked as read."
  }
  ```

---

## 3. Admin Profile API Endpoints (New Feature Requirements)

To support the newly created [AdminProfileSection.jsx](file:///c:/Users/Biz/Documents/MPL%20Website%202%20-%20Edit/apps/web/src/pages/AdminComponents/AdminProfileSection.jsx), the backend needs to implement a new router (e.g., `adminProfile.ts` mounted under `/api/admin/profile` in `index.ts`).

### A. Get Admin Profile & Recent Audit Logs
* **Endpoint:** `GET /api/admin/profile`
* **Authentication:** Required (Admin Token)
* **Description:** Retrieves details of the currently authenticated administrator, including their 15 most recent audit logs sorted chronologically (`desc`).
* **Response `(200 OK)`:**
  ```json
  {
    "success": true,
    "data": {
      "id": "admin-uuid",
      "fullName": "Super Admin",
      "email": "admin@mpl.co.id",
      "role": "SUPERADMIN",
      "createdAt": "2026-01-01T00:00:00Z",
      "activityLogs": [
        {
          "id": "log-uuid-1",
          "actionType": "CREATE_INVOICE",
          "targetTable": "Invoice",
          "targetRecordId": "invoice-uuid",
          "changesSummary": "Membuat faktur INV-2024-001",
          "timestamp": "2026-06-25T14:30:00Z"
        }
      ]
    }
  }
  ```

### B. Update Admin Profile Info
* **Endpoint:** `PATCH /api/admin/profile`
* **Authentication:** Required (Admin Token)
* **Description:** Updates the profile info (name and/or email) of the authenticated administrator. Ensure that if `email` changes, it doesn't conflict with another registered admin.
* **Request Body:**
  ```json
  {
    "fullName": "Updated Admin Name",
    "email": "newadmin@mpl.co.id"
  }
  ```
* **Response `(200 OK)`:**
  ```json
  {
    "success": true,
    "message": "Profile updated successfully",
    "data": {
      "id": "admin-uuid",
      "fullName": "Updated Admin Name",
      "email": "newadmin@mpl.co.id",
      "role": "SUPERADMIN"
    }
  }
  ```

### C. Change Admin Password
* **Endpoint:** `PATCH /api/admin/profile/password`
* **Authentication:** Required (Admin Token)
* **Description:** Verifies the current password and hashes/stores the new password for security. Use `bcrypt` to compare and hash the passwords.
* **Request Body:**
  ```json
  {
    "currentPassword": "oldPassword123",
    "newPassword": "newSecurePassword456"
  }
  ```
* **Response `(200 OK)`:**
  ```json
  {
    "success": true,
    "message": "Password updated successfully"
  }
  ```
* **Error Responses:**
  - `400 Bad Request`: If `newPassword` length is less than 6 characters.
  - `401 Unauthorized`: If the `currentPassword` does not match the stored hash.

---

## 4. Prisma Database & Schema Details

The database models are already registered in [schema.prisma](file:///c:/Users/Biz/Documents/MPL%20Website%202%20-%20Edit/apps/api/prisma/schema.prisma):

```prisma
model Admin {
  id           String    @id @default(uuid())
  fullName     String
  email        String    @unique
  passwordHash String
  role         AdminRole @default(OPERATIONS)
  createdAt    DateTime  @default(now())
  auditLogs    AdminAuditLog[]
  
  @@map("admins")
}

model AdminAuditLog {
  id             String          @id @default(uuid())
  actionType     AuditActionType
  targetTable    String
  targetRecordId String
  changesSummary String?
  timestamp      DateTime        @default(now())
  adminId        String
  admin          Admin           @relation(fields: [adminId], references: [id])

  @@map("admin_audit_logs")
}

model AdminNotification {
  id        String   @id @default(uuid())
  title     String
  message   String
  category  String
  isRead    Boolean  @default(false)
  linkTo    String?
  linkId    String?
  createdAt DateTime @default(now())

  @@map("admin_notifications")
}
```

### Prisma Query Recommendation (fetching profile + logs):
```typescript
const adminProfile = await prisma.admin.findUnique({
  where: { id: req.user.id },
  select: {
    id: true,
    fullName: true,
    email: true,
    role: true,
    createdAt: true,
    auditLogs: {
      orderBy: { timestamp: 'desc' },
      take: 15
    }
  }
})
```
