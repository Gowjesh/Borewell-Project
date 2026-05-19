# Borewell Master — Full Stack Setup Guide

## Files in this package

| File | Purpose |
|------|---------|
| `.env` | All environment variables (rename from `_env`) |
| `db.js` | Supabase client — exits hard if env vars missing |
| `server.js` | Fully corrected Express backend |

---

## Quick Start

### Step 1 — Place files

Copy these three files into your project root (same folder as `package.json`):
```
your-project/
├── .env          ← rename from _env
├── db.js         ← replace existing
├── server.js     ← replace existing
└── borewell-react/   ← your React frontend (npm run build → dist/)
```

### Step 2 — Install dependencies
```bash
npm install
```

### Step 3 — Build the React frontend
```bash
cd borewell-react && npm install && npm run build && cd ..
```

### Step 4 — Start the server
```bash
node server.js
# or for development:
npm run dev
```

The server will:
- Connect to Supabase
- Verify Gmail credentials
- Seed default settings if missing
- Serve the React app on the root URL

---

## Environment Variables

All variables are in `.env`. The critical ones:

| Variable | Required | Notes |
|----------|----------|-------|
| `SUPABASE_URL` | ✅ | Your Supabase project URL |
| `SUPABASE_KEY` | ✅ | Supabase anon key |
| `JWT_SECRET` | ✅ | Change to a long random string in production |
| `GMAIL_USER` | ✅ | Gmail address for sending emails |
| `GMAIL_PASS` | ✅ | Gmail **App Password** (not your real password) |
| `ADMIN_EMAIL` | ✅ | Admin login email |
| `ADMIN_PASSWORD` | ✅ | Admin login password |
| `ADMIN_OTP` | ✅ | 4-digit PIN for 2-step admin login |
| `RAZORPAY_KEY_ID` | ⚠️ | Leave placeholder until you have real keys |
| `RAZORPAY_KEY_SECRET` | ⚠️ | Leave placeholder until you have real keys |

---

## Security Fixes Applied

### Removed ❌
- `process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'` — this disabled TLS verification globally, a serious security hole
- Wildcard CORS (`*`) — replaced with explicit allowed origins

### Added ✅
- **Security headers** on every response (X-Frame-Options, X-Content-Type-Options, X-XSS-Protection)
- **Rate limiting** on `/api/login` and `/api/forgot-password` (10 attempts per 15 min)
- **Input sanitisation** — all user strings stripped of HTML tags
- **Password never returned** in any API response (`stripPassword` helper)
- **File upload validation** — only images allowed, 5 MB max
- **Booking date validation** — past dates rejected server-side
- **Duplicate registration check** — mobile + email uniqueness enforced
- **Admin route isolation** — `/api/admin/merchants` is protected; public `/api/merchants` only returns active merchants
- **Graceful shutdown** — SIGTERM/SIGINT handlers
- **Hard boot failure** if env vars missing

### Fixed Bugs ✅
- `DELETE /admin/bookings/all` used `.neq('id', 0)` which fails for UUID ids — fixed to `.gte('id', 0)`
- Admin bookings page was calling `/api/bookings?all=true` (unauthenticated param) — now uses `/api/admin/merchants` with auth
- Booking similarity check was blocking legitimate bookings — removed
- OTP expiry was not checked consistently — fixed
- Plain-text passwords in DB are auto-upgraded to bcrypt on next login

---

## Supabase Table Schema

Your Supabase project needs these tables:

### `merchants`
```sql
id              bigint primary key generated always as identity
owner_name      text not null
vehicle_name    text not null
mobile          text unique not null
email           text unique not null
password        text not null
location        text
services        text
cost_per_meter  numeric default 0
image_url       text
expiry_date     timestamptz
status          text default 'ACTIVE'
is_taking_bookings boolean default true
created_at      timestamptz default now()
```

### `bookings`
```sql
id               bigint primary key generated always as identity
merchant_id      bigint references merchants(id) on delete cascade
customer_name    text
customer_mobile  text
customer_email   text
customer_address text
date             date
status           text default 'PENDING'
payment_status   text default 'PENDING'
total_amount     numeric default 0
amount_paid      numeric default 0
payment_history  jsonb default '[]'
merchant_location text
drill_depth      text
created_at       timestamptz default now()
```

### `settings`
```sql
key    text primary key
value  text
```

---

## Production Deployment

For Railway, Render, or any Node.js host:
1. Set all `.env` variables as environment variables in your hosting dashboard
2. Set `NODE_ENV=production`
3. The server serves the React build from `borewell-react/dist/`

For Netlify (serverless):
- The `api.js` file (already in your project) wraps the server for Netlify Functions
- Deploy with `netlify deploy`
