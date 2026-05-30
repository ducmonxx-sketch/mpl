# Code Cleanup & Organization TODO

## Status: [IN PROGRESS]

### 1. Create New Folder Structure ✅
- [x] components/LandingComponents/
- [x] components/ClientComponents/  
- [x] components/AdminComponents/
- [x] pages/landing/
- [x] pages/client/
- [x] pages/admin/
- [x] styles/pages/

### 2. Move Files (Step-by-Step)
**Landing Components** (from components/ → components/LandingComponents/)
- [ ] Header.jsx
- [ ] HeroSection.jsx
- [ ] AboutSection.jsx
- [ ] ...

**Client Components** (from pages/dashboard/ → components/ClientComponents/)
- [ ] DashboardSection.jsx
- [ ] ShipmentsSection.jsx
- [ ] ...

**Client Sub-components** (pages/dashboard/components/ → components/ClientComponents/)
- [ ] LeftColumn.jsx
- [ ] ...

**Admin Components** (pages/AdminComponents/ → components/AdminComponents/)
- [ ] OverviewSection.jsx
- [ ] ...

**Page Files**
- [ ] HomePage.jsx → pages/landing/
- [ ] Client* → pages/client/
- [ ] Admin* → pages/admin/

**CSS**
- [ ] All page CSS → styles/pages/

### 3. Update Imports (After Moves)
- [ ] App.jsx
- [ ] All pages
- [ ] All components (sub-imports)

### 4. Testing
- [ ] npm run dev
- [ ] Browser test all routes
- [ ] Fix any import errors

### 5. Cleanup
- [ ] Remove old empty folders
- [ ] Add index files/READMEs
