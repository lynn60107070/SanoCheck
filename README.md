# SanoCheck – Smart Sanitation Verification & Dispatch System

A hybrid sanitation verification platform for humanitarian contexts that maintains a trusted, continuously updated list of usable toilets. SanoCheck combines rule-based health scoring, volunteer verification, and sensor data to prioritize inspections, dispatch maintenance, and provide inclusive access to sanitation information.

---

## ## Core Capabilities

### Health Scoring (0–3, Explainable)

* Whole-number, rule-based scoring (no ML)
* Inputs: volunteer verification, sensor readings, time decay
* Statuses: `verified_usable`, `flagged`, `verified_unusable`
* Volunteer decisions are authoritative

### Interfaces

* **Admin / Volunteer (`/admin`)**: verification queue, maintenance dispatch, sensor dashboards, full registry
* **Public Display (`/public`)**: read-only view, search, favorites (localStorage), zone grouping
* **Demo Mode (`/demo`)**: interactive simulations (time decay, sensors, verification)
* **Chatbot (`/chatbot`)**: read-only assistant for location and status queries

### Sensor Visualization

* 24-hour hourly readings (gas, water, humidity)
* Interactive Recharts graphs
* Per-sensor filtering and averages

---

## ## Tech Stack

* **Frontend**: Next.js 14 (App Router), TypeScript
* **Backend / DB**: Supabase (PostgreSQL, RLS, Edge Functions)
* **Styling**: TailwindCSS, shadcn/ui
* **Charts**: Recharts
* **Deployment**: Vercel

---

## ## Installation & Setup

### Prerequisites

* Node.js 18+
* Supabase account

### Installation

```bash
git clone <repository-url>
cd SanoCheck
npm install
```

### Supabase

1. Create a project
2. Run `supabase/schema.sql`
3. (Optional) Seed demo data: `supabase/seed.sql`
4. (Optional) Seed sensor data: `supabase/seed_sensor_data.sql`

### Environment Variables (`.env.local`)

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

### Run

```bash
npm run dev
```

App runs at `http://localhost:3000`.

### Testing

* Use the Admin dashboard to submit verifications and maintenance requests
* Demo mode allows simulated sensor spikes and time decay
* Public page validates read-only access and search functionality

---

## ## Health Scoring Summary

* **Base score**: 3
* **Volunteer verification**:

  * Mark unusable → score 0, `verified_unusable`
  * Recent verification (<24h) prevents decay
* **Sensors (0–100%)**:

  * Gas high → penalty
  * Water low → penalty
  * Humidity outside 30–60% → penalty
* **Time decay**: score drops without re-verification

**Status rules**:

1. Volunteer marked unusable → `verified_unusable`
2. Score < 2 → `flagged`
3. Otherwise → `verified_usable`

---

## ## API Overview

* **Bathrooms**: `GET /api/bathrooms`, `GET /api/bathrooms/[id]`
* **Verification**: `POST /api/verification`
* **Sensor Data**: `GET /api/sensor-data/[id]`
* **Maintenance**: `GET/POST /api/maintenance`, `PUT /api/maintenance/[id]`
* **Rankings**: `GET /api/rankings?zone=A`
* **Demo**: time decay and sensor simulation endpoints
* **Recalculate**: `GET /api/recalculate`

---

## ## Database (Key Tables)

* **bathrooms**: metadata, health score (0–3), status
* **verifications**: volunteer checks
* **sensor_readings**: gas, water, humidity (percentages)
* **maintenance_tasks**: issue tracking and resolution

RLS enabled; public read, service role for writes.

---

## ## Project Structure (Simplified)

```
app/        # Pages & API routes
lib/        # DB, scoring, utilities
components/ # UI components
supabase/   # Schema & seeds
```

---

## ## Deployment

1. Push to GitHub
2. Import into Vercel
3. Add Supabase env vars
4. Deploy

---

## ## Production Extensions

* Supabase Auth & role-based access
* Realtime updates & notifications
* Mobile app (React Native)
* Analytics & maintenance insights

---

## ## Credits

Built using the following open-source technologies:

* Next.js
* Supabase
* TailwindCSS
* shadcn/ui
* Recharts
* Vercel

Design inspiration drawn from WHO accessibility and information design standards.

## License

Built as an MVP for the **CMUQ Lifelines 2026 Hackathon**.

**Built with ❤️ for better sanitation access**
