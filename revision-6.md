# Revision 6: Admin Dashboard UI & UX Overhaul

This document compiles all updates made in the Revision 6 cycle, focusing on transforming the Administrator Dashboard into a premium, modern, glassmorphic, and high-performance user experience.

---

## 1. Overview of Changes
The primary goal of this revision was to elevate the admin dashboard design, refine layout ergonomics, resolve styling regressions, and introduce key dashboard functionalities (specifically notifications tracking and profile management) using a sleek visual style powered by **Tailwind CSS**.

Key updates include:
- **Layout Modularity:** Extraction of Topbar and Sidebar into dedicated components.
- **Premium Navigation:** A collapsible Sidebar with micro-interactions, tooltip fallbacks, and a bold logo branding header.
- **Decluttered Topbar:** Redesigned Topbar focusing on profile accessibility and notifications, removing the redundant search box.
- **Glassmorphic Notification Panel:** A completely redesigned notification popover featuring distinct categorizations (Driver, Fleet, Invoices), unread indicator styling, and localized state memory.
- **Admin Profile View:** A beautiful dedicated page for personal information updates, password modifications, and a timeline-based activity tracker.

---

## 2. Detailed Component Breakdown

### A. Sidebar Layout: [AdminSidebar.jsx](file:///c:/Users/Biz/Documents/MPL%20Website%202%20-%20Edit/apps/web/src/pages/AdminComponents/layout/AdminSidebar.jsx)
- **Collapsible Support:** Desktop users can collapse the sidebar into a compact 20-rem width view. An interactive hover tooltip displays the section name on hover.
- **Redesigned Header:** Removed the crowded "PT Mahkota Putra Logistik" text. Replaced with a larger, high-fidelity brand logo, centered and styled alongside a sleek "Panel Administrasi" yellow-accented subtitle.
- **Categorized Sections:** Navigation items grouped into semantic sections (`UTAMA`, `OPERASIONAL`, `FINANSIAL`, `SISTEM`) using subtle uppercase headings.
- **Status Indicator Widget:** Added a pulsating live status widget ("Sistem Online") at the bottom of the sidebar to denote service connectivity.
- **Logout Action:** Styled with soft hover transformations, turning red to prompt confirmation.

### B. Topbar Layout: [AdminTopbar.jsx](file:///c:/Users/Biz/Documents/MPL%20Website%202%20-%20Edit/apps/web/src/pages/AdminComponents/layout/AdminTopbar.jsx)
- **Aesthetic Refinement:** Shifted styling to a sticky, frosted-glass header using `backdrop-blur-xl` and background `bg-[#f8f9fa]/80`, framed by an expansive soft drop shadow.
- **Increased Heights & Sizing:** Padded the panel vertical space (`py-6`) and scaled up the notification and avatar components.
- **Profile Navigation Trigger:** Connected the profile avatar element directly to the dashboard page controller so clicking it redirects the admin to the Profile section page.
- **Decluttering:** Cleaned the top level UI by removing the search input field.

### C. Notification Popover: [AdminNotificationPanel.jsx](file:///c:/Users/Biz/Documents/MPL%20Website%202%20-%20Edit/apps/web/src/pages/AdminComponents/components/AdminNotificationPanel.jsx)
- **Tailwind Refactoring:** Fully converted all visual classes to Tailwind utility classes, removing bloated custom styles from [AdminDashboardPage.css](file:///c:/Users/Biz/Documents/MPL%20Website%202%20-%20Edit/apps/web/src/pages/AdminDashboardPage.css).
- **Transparency Fix:** Solved the layout bleed-through bug where background text/tables showed through the popover. The background was solidified to a thick white blur `backdrop-blur-2xl bg-white/95`.
- **Informative Notifications (Driver, Fleet, Invoice Alerts):**
  - **Driver Expiry alerts:** Showcases SIM / STNK license expiry alerts detailing Driver Name and actual due date.
  - **Fleet Expiry alerts:** Showcases vehicle KIR certificates tracking license plate / KIR number and approaching deadlines.
  - **Invoice alerts:** Highlights invoices nearing their due dates.
- **Unread Accent Blocks:** Added gold-tinted active cards (`bg-amber-500/5`) alongside bold gold left-borders (`border-l-4 border-amber-500`) to highlight unread updates.
- **Footer Routing:** Includes a direct click target transitioning admins to full activity overviews.

### D. Admin Profile Page: [AdminProfileSection.jsx](file:///c:/Users/Biz/Documents/MPL%20Website%202%20-%20Edit/apps/web/src/pages/AdminComponents/AdminProfileSection.jsx)
- **Admin Hero Panel:** Styled with dark navy gradient backgrounds (`bg-gradient-to-br from-[#002442] to-[#003866]`), circular abstract glow patterns, and a camera hover shortcut overlay on the profile picture.
- **Personal Details Form:** Responsive text entry fields updating name and email.
- **Password Form:** Fully validation-ready form featuring current password validation and secure password input boxes with field visibility toggle icons.
- **Timeline-based Activity Tracker:** Shows chronological admin log audits (e.g. creating invoices, updating shipments, adding drivers) using customized category icon markers.

---

## 3. Logic & State Enhancements

### A. Dashboard Integration: [AdminDashboardPage.jsx](file:///c:/Users/Biz/Documents/MPL%20Website%202%20-%20Edit/apps/web/src/pages/AdminDashboardPage.jsx)
- **Routing Engine:** Extended local router mappings to support the new `'profile'` active section trigger.
- **Local Alert Cache (`localStorage`):** Implemented client-side caching (`read_alert_ids`) for document expiry alerts (KIR, SIM, Invoices) so admins can dismiss or read local warnings without relying on persistent database writes for transient web-calculated alerts.
- **Micro-Animations:** Implemented a new component wrapper to trigger staggered sliding entrance transitions when moving between views.

---

## 4. File Changes & Project Structure

The following files were created, modified, or deleted during this update cycle:

| Action | File Path |
| :--- | :--- |
| **[NEW]** | [AdminSidebar.jsx](file:///c:/Users/Biz/Documents/MPL%20Website%202%20-%20Edit/apps/web/src/pages/AdminComponents/layout/AdminSidebar.jsx) |
| **[NEW]** | [AdminTopbar.jsx](file:///c:/Users/Biz/Documents/MPL%20Website%202%20-%20Edit/apps/web/src/pages/AdminComponents/layout/AdminTopbar.jsx) |
| **[NEW]** | [AdminProfileSection.jsx](file:///c:/Users/Biz/Documents/MPL%20Website%202%20-%20Edit/apps/web/src/pages/AdminComponents/AdminProfileSection.jsx) |
| **[MODIFY]** | [AdminDashboardPage.jsx](file:///c:/Users/Biz/Documents/MPL%20Website%202%20-%20Edit/apps/web/src/pages/AdminDashboardPage.jsx) |
| **[MODIFY]** | [AdminNotificationPanel.jsx](file:///c:/Users/Biz/Documents/MPL%20Website%202%20-%20Edit/apps/web/src/pages/AdminComponents/components/AdminNotificationPanel.jsx) |
| **[MODIFY]** | [AdminDashboardPage.css](file:///c:/Users/Biz/Documents/MPL%20Website%202%20-%20Edit/apps/web/src/pages/AdminDashboardPage.css) |

---

## 5. Verification Plan

### Manual Layout Validation
1. **Collapsible Sidebar:** Click the toggle button `chevron_left` / `chevron_right` to verify sidebar collapse and hover tooltips.
2. **Topbar Profiling:** Click on the profile section in the top bar to verify redirect logic to the **Profil Admin** screen.
3. **Notification Highlights:** Open the bell icon and verify that unread notifications have the gold-colored left border, soft golden backplate, and custom categorized tags. Verify that underlying text is no longer visible through the notification window.
4. **Password Toggle:** Click the password eye icons to reveal or conceal passwords.
