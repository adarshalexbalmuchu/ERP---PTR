# Palamu Tiger Reserve — Task Management System

A field task management demo app for PTR, built for presentation to senior IFS officers.
Frontend-only with mock data — no backend required.

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:5173/ERP---PTR/](http://localhost:5173/ERP---PTR/) in your browser.

> **Note:** Names, tasks, and designations in the seed data are demo placeholders and can be changed in `src/store/useStore.ts`.

## Demo Logins

| Role | Email | Password |
|------|-------|----------|
| Admin (IFS Deputy Director) | `admin@ptr.in` | `demo123` |
| Field Staff | `staff@ptr.in` | `demo123` |

Both credentials are also shown on the login screen itself.

## Features

### Admin (IFS Officer)
- Dashboard with 5 metric cards + staff workload bar chart (Recharts)
- Full task list with search, filters (staff / status / priority / overdue), and sort
- Create, edit, delete tasks — single assignee enforced
- Approve tasks or request changes (with optional note) when a task is marked Done
- Comment on any task; upload file attachments
- Notification bell — notified when a task is submitted for approval

### Staff (Field)
- Mobile-first "My Tasks" list — only sees their own assigned tasks
- **Acknowledge & Start** button on Unread tasks (closed-loop handshake)
- **Mark as Done** button on In-Progress tasks — notifies the admin
- Upload images / PDF / Excel as attachments; comment on tasks
- Notification bell — notified when a new task is assigned

### Shared
- Overdue detection — red due dates and "Overdue" badge when past due and not yet approved
- All state persists in `localStorage` (Zustand `persist`) — survives refreshes and re-logins
- Responsive: sidebar layout for admin on desktop, top-bar + hamburger on mobile, single-column for staff

## Deploy to Vercel

1. Push this repo to GitHub
2. Import into [vercel.com](https://vercel.com) — Vite is auto-detected
3. No environment variables needed; build command is `npm run build`, output is `dist/`

## Deploy to GitHub Pages

A GitHub Actions workflow (`.github/workflows/deploy.yml`) is included.

1. Go to **Settings → Pages → Source** and select **GitHub Actions**
2. Push to `main` — the workflow builds and deploys automatically
3. Live at: `https://<your-username>.github.io/ERP---PTR/`

## Tech Stack

- React 19 + Vite 8 + TypeScript
- Tailwind CSS 3
- React Router v7
- Zustand v5 (with `persist` middleware)
- Recharts v3
- date-fns v4
- lucide-react
