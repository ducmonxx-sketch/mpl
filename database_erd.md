# MPL System Database ERD (Client & Admin)

Based on the existing client dashboard and the planned Admin CRM, here is the modernized Relational Database Schema. The Admin CRM will serve as the master controller, capable of mutating all records.

```mermaid
erDiagram
    %% Admin Management
    ADMINS {
        uuid id PK
        string full_name
        string email UK
        string password_hash
        string role "e.g., superadmin, operations, support"
        datetime created_at
    }

    ADMIN_AUDIT_LOGS {
        uuid id PK
        uuid admin_id FK
        string action_type "e.g., VERIFY_USER, UPDATE_DRIVER"
        string target_table
        uuid target_record_id
        text changes_summary
        datetime timestamp
    }

    %% Core User Management
    USERS {
        uuid id PK
        string full_name
        string company_name
        string email UK
        string password_hash
        string phone_number
        string verification_status "e.g., pending, verified"
        uuid verified_by_admin_id FK "Nullable"
        datetime created_at
        datetime updated_at
    }

    USER_SETTINGS {
        uuid id PK
        uuid user_id FK
        boolean email_notifications
        boolean whatsapp_notifications
        string language
        string theme "e.g., light, dark"
    }

    %% Master Data (Managed by Admin)
    DRIVERS {
        uuid id PK
        string full_name
        string phone_number
        string status "e.g., active, unavailable"
        uuid last_updated_by_admin_id FK
    }

    VEHICLES {
        uuid id PK
        string type "e.g., Hino 500, Mitsubishi Colt"
        string license_plate UK
        string status
        uuid last_updated_by_admin_id FK
    }

    %% Shipments Tracking & Logistics (Posted & Managed by Admin)
    SHIPMENTS {
        string id PK "e.g., #MPL-90234-JKT"
        uuid client_id FK
        uuid driver_id FK "Nullable until assigned"
        uuid vehicle_id FK "Nullable until assigned"
        
        string package_type
        decimal weight_kg
        string service_level
        string origin_location
        string destination_location
        text special_notes
        
        string status "pending, transit, delivered, failed, cancelled"
        int current_progress_percent
        datetime pickup_date
        datetime completion_date
        datetime created_at
        uuid created_by_admin_id FK "Nullable (if client created)"
        uuid last_updated_by_admin_id FK
    }

    SHIPMENT_EVENTS {
        uuid id PK
        string shipment_id FK
        string step_name
        string location
        string status "done, active, upcoming"
        string driver_notes
        datetime event_timestamp
        uuid created_by_admin_id FK
    }

    NOTIFICATIONS {
        uuid id PK
        uuid user_id FK
        string title
        text message
        boolean is_read
        uuid sent_by_admin_id FK "Nullable (System generated vs Manual)"
        datetime created_at
    }

    %% Relationships
    ADMINS ||--o{ USERS : "verifies"
    ADMINS ||--o{ NOTIFICATIONS : "sends manual alerts to"
    ADMINS ||--o{ DRIVERS : "manages"
    ADMINS ||--o{ VEHICLES : "manages"
    ADMINS ||--o{ SHIPMENTS : "posts & updates"
    ADMINS ||--o{ SHIPMENT_EVENTS : "creates timeline events for"
    ADMINS ||--o{ ADMIN_AUDIT_LOGS : "generates trackable action in"
    
    USERS ||--o| USER_SETTINGS : "has"
    USERS ||--o{ SHIPMENTS : "creates / owns"
    USERS ||--o{ NOTIFICATIONS : "receives"
    
    DRIVERS ||--o{ SHIPMENTS : "assigned to"
    VEHICLES ||--o{ SHIPMENTS : "used for"
    
    SHIPMENTS ||--o{ SHIPMENT_EVENTS : "tracks progress via"
```

### Table Breakdown

1. **`ADMINS`**: The central controllers of the CRM. Contains role-based access control (e.g., superadmin vs support).
2. **`ADMIN_AUDIT_LOGS`**: A crucial tracking table. Since admins can change anything in the CRM, this table records *who* changed *what* and *when* (e.g., "Admin B updated the status of Driver X").
3. **`USERS`**: The client accounts. Admins interact with this table to approve/verify pending client registrations via the `verified_by_admin_id` tracker.
4. **`DRIVERS` & `VEHICLES`**: Core operational logistics data explicitly managed and updated by administrators inside the CRM.
5. **`SHIPMENTS` & `SHIPMENT_EVENTS`**: Tracks operational freight data. Admins can both post new shipments (acting on behalf of clients) or create distinct linear `SHIPMENT_EVENTS` (like assigning a package to the "Customs" status).
6. **`NOTIFICATIONS`**: Aside from system-generated alerts, an admin ID is linked here for times when operations staff push manual alerts/messages to a client's dashboard.
