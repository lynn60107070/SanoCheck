# SanoCheck - Smart Sanitation Verification & Dispatch System

A hybrid sanitation verification system that maintains a trusted, continuously updated list of usable toilets using rule-based health scoring, optimizes volunteer inspections, and provides inclusive access to information.

## 🎯 Core Goal

Build a verification and prioritization system that:
- Maintains a trusted, continuously updated list of usable toilets
- Uses rule-based, explainable health scoring
- Optimizes volunteer inspections and maintenance dispatch
- Provides inclusive access (phones + public displays)

**This is NOT:**
- Real-time monitoring
- Predictive AI
- Fully automated maintenance
- Crowdsourced decision-making

## 🧱 Tech Stack

- **Next.js 14** (App Router)
- **TypeScript**
- **API Routes** (used as backend)
- **In-memory data store** (easily swappable to Prisma/SQLite)
- **Tailwind CSS**
- **No authentication** (role switcher in UI)

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ installed
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

The application will be available at `http://localhost:3000`

### Build for Production

```bash
npm run build
npm start
```

## 📊 System Architecture

All components feed into one shared bathroom state model.

### Core Components

1. **Central Bathroom Health Scoring Engine** (`lib/scoring.ts`)
   - Rule-based, explainable scoring logic
   - Configurable penalties and bonuses
   - Pure functions, no black-box ML

2. **Data Store** (`lib/store.ts`)
   - In-memory storage with JSON-like structure
   - Easy to swap to Prisma/SQLite for production
   - Automatic score recalculation on data changes

3. **API Routes** (`app/api/`)
   - RESTful endpoints for all operations
   - No authentication (hackathon MVP)

4. **Frontend Views**
   - Admin/Volunteer Dashboard
   - Resident Dashboard (mobile-friendly)
   - Public Dashboard (read-only)
   - Demo Mode
   - Optional Chatbot

## 🧮 Bathroom Health Scoring Engine

The scoring engine is **pure, readable, and explainable**. All rules are transparent and configurable.

### Base Logic

```
Start score = 100
-40 if no water (volunteer verified)
-40 if clogged (volunteer verified)
-50 if volunteer marks unusable
-10 per day since last verification
-20 if gas level above threshold (50)
+2 per resident "usable" confirmation (capped at +10)
-15 per resident "unusable" report
Clamp score to 0–100
```

### Status Mapping

- **80–100** → ✅ Verified usable
- **50–79** → ⚠️ Needs recheck
- **20–49** → 🚩 Flagged
- **0–19** → ❌ Verified unusable

### Key Principles

- Sensor data cannot mark usable/unusable alone — it only affects priority
- Volunteer verification is the authoritative source
- Resident signals provide small adjustments
- Time decay encourages regular verification

## 📋 Volunteer Task Ranking

The system generates a daily "To-Do List" per zone, ranking bathrooms by:

1. **Lowest score** (highest priority)
2. **Sensor anomaly present** (gas level > threshold)
3. **Recent resident "unusable" signal** (within 24 hours)
4. **Longest time since last check**

No routing optimization — just prioritized lists.

## 🖥️ Views

### 1. Admin/Volunteer Dashboard (`/admin`)

**Features:**
- Bathroom registry table with health scores and status badges
- Volunteer To-Do List (ranked, with reason badges)
- Verification checklist per bathroom
- Maintenance dispatch panel
  - List of confirmed unusable bathrooms
  - Issue type selection (Plumbing, Water Supply, Structural, Hygiene/Cleaning)
  - Status tracking (Not Assigned, In Progress, Resolved)

**Use Cases:**
- Volunteers check bathrooms and submit verifications
- Administrators dispatch maintenance requests
- WASH coordinators monitor overall system health

### 2. Resident Dashboard (`/resident`)

**Features:**
- List of verified usable bathrooms only
- Mobile-friendly design
- Distance indicators (mocked, zone-based)
- Gender/accessibility tags
- Confirmation prompt after viewing bathroom
  - Simple buttons: ✅ Yes / ❌ No
  - No text input, no photos, no public scoring
- "Community Helper" badge system
- Thank-you messages

**Use Cases:**
- Residents find usable bathrooms
- Quick status confirmation
- Community engagement

### 3. Public Dashboard (`/public`)

**Characteristics:**
- Read-only
- Updated once per day (or on manual refresh)
- Zone-based list of usable bathrooms
- "Last updated at..." timestamp
- No interaction, no reporting
- Designed for mosques, clinics, food centers

**Use Cases:**
- Public displays in community centers
- Static information boards
- Non-interactive information sharing

### 4. Demo Mode (`/demo`)

**Features:**
- Simulation buttons for testing:
  - Resident "unusable" signal
  - Resident "usable" confirmation
  - Gas spike simulation
  - Time decay simulation (+5 days)
  - Volunteer verification (usable/unusable)
- Real-time score updates
- Visible state changes
- To-do list reordering

**Use Cases:**
- Judging demonstrations
- System testing
- Understanding how scoring works

### 5. Chatbot (`/chatbot`) - Optional

**Features:**
- Answers: "Where is the nearest usable toilet?"
- Answers: "What should I check today?"
- Read-only (reads system state only)
- Does NOT accept reports

## 🌡️ Sensor Integration (Simulated)

**API Endpoint:** `POST /api/sensor-update`

Accepts gas level input. If threshold exceeded:
- Decreases score
- Increases volunteer priority

This is a proof of hybrid feasibility, not IoT production.

## 📡 API Endpoints

### Bathrooms
- `GET /api/bathrooms` - Get all bathrooms
- `GET /api/bathrooms/[id]` - Get specific bathroom with details

### Verification
- `POST /api/verification` - Submit volunteer verification
  ```json
  {
    "bathroomId": "A-03",
    "waterAvailable": true,
    "clogged": false,
    "usable": true,
    "volunteerName": "Volunteer 1"
  }
  ```

### Resident Signals
- `POST /api/resident-signal` - Submit resident confirmation
  ```json
  {
    "bathroomId": "A-03",
    "signal": "usable" // or "unusable"
  }
  ```

### Sensor
- `POST /api/sensor-update` - Submit sensor reading
  ```json
  {
    "bathroomId": "A-03",
    "gasLevel": 45
  }
  ```

### Maintenance
- `GET /api/maintenance` - Get all maintenance requests
- `POST /api/maintenance` - Create maintenance request
- `PUT /api/maintenance/[id]` - Update maintenance request status

### Rankings
- `GET /api/rankings` - Get ranked bathrooms for inspection
- `GET /api/rankings?zone=A` - Get ranked bathrooms for specific zone

## 🎬 Demo Flow

1. **Start the application**
   ```bash
   npm run dev
   ```

2. **Navigate to Demo Mode** (`/demo`)
   - Select a bathroom from the dropdown
   - Click simulation buttons to trigger events
   - Watch scores update in real-time
   - See to-do list reorder automatically

3. **View Admin Dashboard** (`/admin`)
   - See ranked to-do list
   - Verify a bathroom
   - Create maintenance request for unusable bathroom
   - Watch scores recalculate

4. **View Resident Dashboard** (`/resident`)
   - See only usable bathrooms
   - Click "I used this bathroom"
   - Confirm status
   - Earn Community Helper badge

5. **View Public Dashboard** (`/public`)
   - See read-only zone-based list
   - Check last updated timestamp

## 🏗️ Project Structure

```
SanoCheck/
├── app/
│   ├── api/              # API routes
│   │   ├── bathrooms/
│   │   ├── verification/
│   │   ├── resident-signal/
│   │   ├── sensor-update/
│   │   ├── maintenance/
│   │   └── rankings/
│   ├── admin/            # Admin dashboard
│   ├── resident/         # Resident dashboard
│   ├── public/           # Public dashboard
│   ├── demo/             # Demo mode
│   ├── chatbot/          # Optional chatbot
│   ├── layout.tsx         # Root layout
│   ├── page.tsx          # Home page
│   └── globals.css       # Global styles
├── lib/
│   ├── types.ts          # TypeScript types
│   ├── scoring.ts        # Scoring engine
│   └── store.ts          # Data store
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── README.md
```

## 🔧 Configuration

### Scoring Configuration

Edit `lib/types.ts` to modify scoring rules:

```typescript
export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  baseScore: 100,
  noWaterPenalty: 40,
  cloggedPenalty: 40,
  unusablePenalty: 50,
  daysSinceVerificationPenalty: 10,
  gasThreshold: 50,
  gasPenalty: 20,
  residentUsableBonus: 2,
  residentUnusablePenalty: 15,
};
```

### Initial Data

Sample bathrooms are initialized in `lib/store.ts` in the `initializeStore()` function. Modify this to add/remove bathrooms or change initial states.

## 📈 Scalability Discussion

### Current Implementation (MVP)
- In-memory data store
- Single server instance
- No persistence between restarts
- Suitable for demo/judging

### Production Considerations

1. **Database Migration**
   - Replace in-memory store with Prisma + SQLite/PostgreSQL
   - Add proper migrations
   - Implement data persistence

2. **Authentication & Authorization**
   - Add role-based access control
   - Secure API endpoints
   - User management system

3. **Real-time Updates**
   - WebSocket support for live score updates
   - Push notifications for volunteers
   - Real-time sensor data streams

4. **Performance**
   - Caching layer (Redis)
   - Database indexing
   - API rate limiting
   - CDN for static assets

5. **Mobile App**
   - React Native app
   - Offline support
   - Push notifications

6. **Analytics**
   - Usage tracking
   - Score trend analysis
   - Maintenance prediction insights

7. **Deployment**
   - Vercel (current recommendation)
   - Docker containerization
   - CI/CD pipeline
   - Environment variable management

## ✅ Success Criteria

Judges must be able to:
- ✅ Run the project (`npm install && npm run dev`)
- ✅ Click buttons and see scores change
- ✅ See priorities update automatically
- ✅ Understand exactly why the system made a decision (explainable scoring)

## 🚫 Explicit Non-Goals

These features were intentionally NOT implemented:
- ❌ Real-time monitoring
- ❌ Predictive failure AI
- ❌ Crowdsourced decision-making
- ❌ Payments or incentives
- ❌ Routing optimization
- ❌ Continuous sensor streams

## 📝 License

This project was built for the CMUQ Lifelines 2026 Hackathon.

## 👥 Team

Built as a hackathon MVP prototype.

---

**Built with ❤️ for better sanitation access**
