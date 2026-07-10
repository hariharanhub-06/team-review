# Team Work Tracker & Productivity Management

A full-stack web app for tracking daily work, attendance, breaks, projects/tasks, and team
productivity — with a detailed admin analytics dashboard.

Built with **Next.js 15 (App Router) + TypeScript**, **Prisma + Neon (PostgreSQL)**,
**custom JWT auth**, **Tailwind CSS** (dark mode), and **Recharts**.

---

## Features

### Authentication & Roles
- Secure email/password login with bcrypt hashing and JWT stored in an httpOnly cookie.
- Two roles: **Admin** and **Team Member**. Route protection via middleware.
- Admin can create / edit / delete users and assign roles.

### Member Dashboard
- **Mark Login / Mark Logout** with timestamps.
- Mandatory **Planned Work** on login; **Work Completed**, **Status**, and **Remarks** on logout.
- **Breaks & Lunch tracking** — "Out for Break/Lunch" ↔ "Back to Work" toggle; every break period is
  recorded, with total break time and **net active time** (presence − breaks).
- **Project & Task logging** — dynamic add/remove rows (Project · Task · Hours) with a running total.
- Auto-logout reminder banner after 8h of presence.

### Admin
- **User Management** — CRUD, role assignment, and per-user login/logout history.
- **Project Management** — projects (name, description, start/end, deliverables) and tasks with
  deadlines, status, and assignees; overdue tasks flagged.
- **Work Logs** — all daily logs in a filterable table (user · date range · project · status) with
  break/net-active columns and **CSV export**.
- **Analytics dashboard** (detailed) — team KPIs, per-member drill-down, total productivity time,
  projects per person, bar/line/pie charts, a monthly leaderboard with **productivity scores**,
  deadline tracking, and a print-friendly monthly report (`🖨 Print`).

### Productivity Scoring (0–100)
Weighted blend of **effort** (hours vs expected), **timeliness** (tasks done on/before deadline),
and **consistency** (days logged). Members are ranked monthly.

---

## Getting Started

### 1. Environment
Copy `.env.example` to `.env` and fill in:

```
DATABASE_URL="postgresql://user:password@host/db?sslmode=require"   # Neon connection string
JWT_SECRET="a-long-random-string"
ADMIN_EMAIL="you@example.com"
ADMIN_PASSWORD="your-password"
ADMIN_NAME="Your Name"
```

### 2. Install & set up the database
```bash
npm install
npm run db:push     # create tables in Neon
npm run db:seed     # seed admin + sample members/projects/tasks/logs
```

### 3. Run
```bash
npm run dev         # http://localhost:3000
```

Production:
```bash
npm run build
npm run start
```

---

## Default Credentials (after seeding)
- **Admin:** the `ADMIN_EMAIL` / `ADMIN_PASSWORD` from your `.env`.
- **Sample members:** `alice@teams.local`, `bob@teams.local`, `carol@teams.local` — password `password123`.

---

## Tech Stack
| Layer | Tech |
|-------|------|
| Framework | Next.js 15 (App Router, TypeScript) |
| Database | Neon (PostgreSQL) via Prisma ORM |
| Auth | JWT (`jose`) + `bcryptjs`, httpOnly cookie |
| UI | Tailwind CSS, dark mode (`next-themes`) |
| Charts | Recharts |
| Validation | Zod |
| Export | CSV via `papaparse` |

## Project Structure
```
prisma/schema.prisma      # data model (User, DailyLog, Break, Project, Task, WorkEntry)
src/lib/                  # db, auth, analytics, scoring, validation, utils
src/components/           # ui primitives, app shell, charts, theme
src/app/                  # pages + API route handlers (App Router)
src/middleware.ts         # route protection
```

## Scripts
- `npm run dev` / `build` / `start`
- `npm run db:push` — sync schema to the database
- `npm run db:seed` — seed sample data
- `npm run db:studio` — open Prisma Studio
