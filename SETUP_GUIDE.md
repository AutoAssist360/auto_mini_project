# Quick Auto Assist — Setup Guide

Follow these steps to clone, install and run the full project on your PC.

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| **Node.js** | v20 or later | https://nodejs.org |
| **npm** | 10+ (comes with Node) | — |
| **Git** | any recent version | https://git-scm.com |

> **Database:** The project uses a cloud-hosted **Neon PostgreSQL** database. The connection string is already in the `.env` file — no local DB setup needed.

---

## Step 1 — Clone the repo

Open a terminal and run:

```bash
git clone <YOUR_GITHUB_REPO_URL>
cd mini_project
```

---

## Step 2 — Install all dependencies (6 terminals, or one-by-one)

You need to run `npm install` inside **6 folders**. You can do them all in one terminal:

```bash
cd backend
npm install
cd ..

cd landing_page
npm install
cd ..

cd user_dashboard
npm install
cd ..

cd technician_dashboard
npm install
cd ..

cd vender_dashboard
npm install
cd ..

cd admin_dashboard
npm install
cd ..
```

---

## Step 3 — Generate Prisma client

The generated Prisma client is included in the repo, but if you face any issues run:

```bash
cd backend
npx prisma generate
cd ..
```

---

## Step 4 — Start the backend (Terminal 1)

Open **Terminal 1** and run:

```bash
cd backend
npm run dev
```

You should see: **Server is running on port 3000**

> Keep this terminal open.

---

## Step 5 — Start the Landing Page (Terminal 2)

Open **Terminal 2** and run:

```bash
cd landing_page
npm run dev
```

This starts on **http://localhost:5173**

> Keep this terminal open.

---

## Step 6 — Start the User Dashboard (Terminal 3)

Open **Terminal 3** and run:

```bash
cd user_dashboard
npm run dev
```

This starts on **http://localhost:5174**

> Keep this terminal open.

---

## Step 7 — Start the Technician Dashboard (Terminal 4)

Open **Terminal 4** and run:

```bash
cd technician_dashboard
npm run dev
```

This starts on **http://localhost:5175**

> Keep this terminal open.

---

## Step 8 — Start the Vendor Dashboard (Terminal 5)

Open **Terminal 5** and run:

```bash
cd vender_dashboard
npm run dev
```

This starts on **http://localhost:5176**

> Keep this terminal open.

---

## Step 9 — Start the Admin Dashboard (Terminal 6)

Open **Terminal 6** and run:

```bash
cd admin_dashboard
npm run dev
```

This starts on **http://localhost:5177**

> Keep this terminal open.

---

## Port Summary

| App | Port | URL |
|-----|------|-----|
| Backend API | 3000 | http://localhost:3000 |
| Landing Page | 5173 | http://localhost:5173 |
| User Dashboard | 5174 | http://localhost:5174 |
| Technician Dashboard | 5175 | http://localhost:5175 |
| Vendor Dashboard | 5176 | http://localhost:5176 |
| Admin Dashboard | 5177 | http://localhost:5177 |

> **Note:** Each app has its port hardcoded in `vite.config.js`, so you can start them in any order.

---

## How to use

1. Go to **http://localhost:5173** (Landing Page) — from here you can navigate to sign-up/sign-in pages for each role.
2. **Sign up** as a User, Technician, or Vendor through their respective dashboards.
3. **Admin login** is at http://localhost:5177 — the admin account must be seeded directly in the database.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `ECONNREFUSED` on API calls | Make sure the backend is running on port 3000 (Terminal 1) |
| Wrong dashboard on wrong port | Stop all frontends, restart them in order: landing → user → tech → vendor → admin |
| Prisma errors | Run `cd backend && npx prisma generate` then restart the backend |
| Port already in use | Close whatever is using that port, or kill all node processes: `taskkill /F /IM node.exe` (Windows) or `killall node` (Mac/Linux) |

---

## Tech Stack

- **Backend:** Express 5, Prisma 7, PostgreSQL (Neon), JWT + httpOnly Cookies
- **Frontend:** React 19, Vite 7, Redux Toolkit, TailwindCSS 4
- **Auth:** httpOnly cookie-based (no tokens in localStorage)
