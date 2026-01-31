# SanoCheck – Smart Sanitation Verification & Dispatch System

SanoCheck is a hybrid sanitation verification platform for humanitarian contexts that maintains a trusted, continuously updated list of usable toilets. It combines rule‑based health scoring, volunteer verification, **community feedback**, and **sensor data (historical + real‑time)** to prioritize inspections, dispatch maintenance, and provide inclusive, transparent sanitation information to residents and responders.

Built as an MVP for the **CMUQ Lifelines 2026 Hackathon**.

---

## Core Capabilities

### Health Scoring (0–3, Explainable)

* Whole‑number, rule‑based scoring (**no ML**)
* Inputs:

  * Volunteer verification (authoritative)
  * Sensor readings (gas, water, humidity)
  * **Community feedback (resident usable / not usable)**
  * Time decay
* Statuses:

  * `verified_usable`
  * `flagged`
  * `verified_unusable`
* Volunteer decisions override all other signals

### Community Feedback Loop (NEW)

* Lightweight **resident phone view** for quick feedback
* Residents can mark bathrooms as usable / not usable
* Feedback contributes to:

  * Temporary score penalties
  * Automatic **flagging for volunteer verification**
* Designed for low‑bandwidth, high‑trust environments

---

## Interfaces

### Admin / Volunteer (`/admin`)

* Verification queue (volunteer + community‑flagged)
* Maintenance dispatch & resolution workflow
* Sensor dashboards (historical + real‑time)
* Full bathroom registry
* **Insights dashboard highlighting:**

  * Service gaps
  * Usage frequency
  * Urgent hygiene needs
  * Overcrowded or under‑served zones

### Public Display (`/public`)

* Read‑only bathroom registry
* Search & zone grouping
* Favorites (stored via `localStorage`)
* **Interactive map view** with color‑coded bathroom status
* Designed for info boards and shared displays

### Resident Phone View (`/resident`) (NEW)

* Simple mobile‑friendly interface
* Submit bathroom feedback (usable / not usable)
* View nearby bathrooms and current status

### Demo Mode (`/demo`)

* Interactive simulations:

  * Time decay
  * Sensor spikes
  * Real‑time sensor streaming
* Useful for live demos and stakeholder walkthroughs

### Chatbot (`/chatbot`)

* Read‑only assistant
* Answers location, availability, and status queries

---

## Sensor Visualization

### Historical Sensor Data (NEW)

* View **previously loaded sensor data**
* Date selector (calendar‑based)
* 24‑hour, hourly resolution

### Real‑Time Sensor Data (NEW)

* Live updating sensor graphs for demo purposes
* Demonstrates active sensor connectivity

### Metrics

* Gas levels
* Water availability
* Humidity

### Charts

* Interactive **Recharts** graphs
* Per‑sensor filtering
* Averages & trends

---

## Mapping & Spatial Insights (NEW)

* Interactive map showing all toilets
* Color‑coded by health status
* **Heatmaps** highlighting:

  * Overcrowded bathrooms
  * Under‑serviced areas
  * Sanitation gaps
* Area maps integrated into public info boards for residents

---

## Tech Stack

* **Frontend:** Next.js 14 (App Router), TypeScript
* **Backend / DB:** Supabase (PostgreSQL, RLS, Edge Functions)
* **Styling:** TailwindCSS, shadcn/ui
* **Charts:** Recharts
* **Maps:** Map-based visualization (demo integration)
* **Deployment:** Vercel

---

## Installation & Setup

### Prerequisites

* Node.js 18+
* Supabase account

### Installation

```bash
git clone <repository-url>
cd SanoCheck
npm install
```

### Supabase Setup

1. Create a new Supabase project
2. Run:

   ```sql
   supabase/schema.sql
   ```
3. (Optional) Seed demo data:

   ```sql
   supabase/seed.sql
   ```
4. (Optional) Seed sensor data:

   ```sql
   supabase/seed_sensor_data.sql
   ```

### Environment Variables (`.env.local`)

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...   # Required: Dashboard → API → service_role (secret)
```

⚠️ **Important**
If verifications or scores reset on refresh, the `SUPABASE_SERVICE_ROLE_KEY` is missing. All bathroom reads/writes require it due to RLS. Restart the dev server after adding it.

---

## Run

```bash
npm run dev
```

App runs at: **[http://localhost:3000](http://localhost:3000)**

---

## Testing

* Use the Admin dashboard to:

  * Submit volunteer verifications
  * Review community feedback flags
  * Create & resolve maintenance requests
* Demo mode:

  * Simulate sensor changes
  * Stream real‑time sensor data
  * Trigger time decay
* Public & resident views:

  * Validate read‑only access
  * Test maps, heatmaps, and search

---

## Health Scoring Summary

**Base score:** 3

### Volunteer Verification

* Mark unusable → score = 0, status = `verified_unusable`
* Recent verification (< 24h) prevents decay

### Community Feedback

* Repeated negative feedback applies penalties
* Automatically flags bathroom for volunteer review

### Sensors (0–100%)

* High gas → penalty
* Low water → penalty
* Humidity outside 30–60% → penalty

### Time Decay

* Score decreases without re‑verification

### Status Rules

* Volunteer marked unusable → `verified_unusable`
* Score < 2 → `flagged`
* Otherwise → `verified_usable`

---

## API Overview

* **Bathrooms:**

  * `GET /api/bathrooms`
  * `GET /api/bathrooms/[id]`
* **Verification:**

  * `POST /api/verification`
* **Community Feedback:**

  * `POST /api/feedback`
* **Sensor Data:**

  * `GET /api/sensor-data/[id]`
  * Real‑time demo endpoints
* **Maintenance:**

  * `GET /api/maintenance`
  * `POST /api/maintenance`
  * `PUT /api/maintenance/[id]`
* **Rankings:**

  * `GET /api/rankings?zone=A`
* **Recalculate Scores:**

  * `GET /api/recalculate`

---

## Database (Key Tables)

* `bathrooms` – metadata, health score (0–3), status
* `verifications` – volunteer checks
* `feedback` – resident usability reports
* `sensor_readings` – gas, water, humidity (percentages)
* `maintenance_tasks` – issue tracking & resolution

RLS enabled:

* Public read access
* Service role required for writes

---

## Project Structure (Simplified)

```
app/         # Pages & API routes
lib/         # DB, scoring, utilities
components/  # UI components
supabase/    # Schema & seeds
```

---

## Deployment

1. Push to GitHub
2. Import into Vercel
3. Add Supabase environment variables
4. Deploy

---

## Production Extensions

* Supabase Auth & role‑based access
* Realtime alerts & notifications
* Mobile app (React Native)
* Advanced analytics & maintenance forecasting
* Offline‑first resident feedback

---

## Credits

Built using open‑source technologies:

* Next.js
* Supabase
* TailwindCSS
* shadcn/ui
* Recharts
* Vercel

Design inspiration drawn from **WHO accessibility and information design standards**.

---

## License

MIT License

Copyright (c) 2026 SanoCheck

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
