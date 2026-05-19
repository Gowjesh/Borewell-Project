# Borewell Master — React Frontend

This is a fully flexible React (Vite) conversion of the original multi-page HTML project.
The UI and design are **exactly preserved** — same colors, fonts, glassmorphism, and responsive layout.

---

## Project Structure

```
borewell-react/
├── index.html               # Single HTML entry point
├── vite.config.js           # Vite config with /api proxy → localhost:3000
├── package.json
└── src/
    ├── main.jsx             # React root
    ├── App.jsx              # All routes (React Router v6)
    ├── index.css            # Global styles (your style.css + React extras)
    ├── context/
    │   └── AuthContext.jsx  # Auth state (login/logout/fetchWithAuth)
    ├── components/
    │   ├── Navbar.jsx       # Shared responsive navbar
    │   └── Modal.jsx        # Replaces customAlert/customConfirm/customPrompt
    └── pages/
        ├── HomePage.jsx
        ├── MerchantLoginPage.jsx
        ├── AdminLoginPage.jsx
        ├── MerchantRegisterPage.jsx
        ├── ForgotPasswordPage.jsx
        ├── CustomerPage.jsx
        ├── BookingPage.jsx
        ├── MerchantDashboard.jsx
        └── AdminDashboard.jsx
```

---

## Setup

### 1. Install dependencies
```bash
cd borewell-react
npm install
```

### 2. Start your existing backend
```bash
# In the original project folder:
node server.js
# Backend runs on http://localhost:3000
```

### 3. Start the React frontend (dev mode)
```bash
npm run dev
# Frontend runs on http://localhost:5173
# All /api requests are proxied to localhost:3000 automatically
```

### 4. Build for production
```bash
npm run build
# Output goes to dist/ folder
```

---

## Deploying to Production

Replace your old `server.js` static file serving with:

```js
// In server.js — serve React build
const path = require('path');
app.use(express.static(path.join(__dirname, 'borewell-react/dist')));

// Catch-all: return React app for all non-API routes
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'borewell-react/dist/index.html'));
  }
});
```

---

## Route Mapping (Old → New)

| Old HTML File              | New React Route         |
|---------------------------|-------------------------|
| index.html                | /                       |
| merchant_login.html       | /merchant-login         |
| admin_login.html          | /admin-login            |
| merchant_register.html    | /merchant-register      |
| forgot_password.html      | /forgot-password        |
| customerpage.html         | /find-merchants         |
| booking.html              | /booking?merchant_id=X  |
| merchant_dashboard.html   | /merchant-dashboard     |
| admin_dashboard.html      | /admin-dashboard        |

Old `.html` URLs are auto-redirected to new routes.

---

## Key Changes from Original

- **Single Page App** — no full page reloads between pages
- **React Router** — client-side navigation
- **AuthContext** — replaces localStorage user checks in every HTML file
- **Modal component** — replaces the inline `customAlert/customConfirm/customPrompt` functions
- **All API calls preserved** — same `/api/*` endpoints, zero backend changes needed
- **Vite proxy** — `/api` requests forwarded to your Express server in dev mode

---

## Logo

Copy your `logo.png` into `borewell-react/public/logo.png` so the favicon works.
