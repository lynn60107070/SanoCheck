# SanoCheck - Smart Sanitation Verification & Dispatch System

A hybrid sanitation verification system that maintains a trusted, continuously updated list of usable toilets using rule-based health scoring, optimizes volunteer inspections, and provides inclusive access to information.

## 📋 Project Description

**SanoCheck** is a verification and prioritization system designed for humanitarian contexts to maintain reliable bathroom facilities. The system uses rule-based, explainable health scoring (0-3 scale) to prioritize volunteer inspections and maintenance dispatch. It provides multiple access points including admin dashboards for volunteers, public displays for community centers, and an interactive demo mode for demonstrations.

## ✨ Key Features

### 🎯 Core Features

1. **Rule-Based Health Scoring (0-3 Scale)**
   - Transparent, explainable scoring system
   - Whole number scores (0, 1, 2, 3)
   - Factors: volunteer verification, sensor readings, time decay
   - Status mapping: `verified_usable`, `flagged`, `verified_unusable`

2. **Admin/Volunteer Dashboard** (`/admin`)
   - **Verification Queue**: Prioritized list of bathrooms needing inspection
   - **Maintenance Dispatch**: Create and track maintenance requests
   - **Sensor Data Dashboard**: View 24-hour sensor readings with interactive graphs
   - **All Bathrooms View**: Complete registry with health scores and status
   - Real-time score recalculation on verification
   - Zone-based filtering

3. **Public Display** (`/public`)
   - Read-only dashboard for community centers
   - Search functionality (by ID, zone, type, location)
   - Favorites/saved bathrooms (stored in localStorage)
   - Zone-based organization
   - Disclaimer about data freshness (24-hour delay)
   - Contact information display

4. **Demo Mode** (`/demo`)
   - Interactive simulation controls
   - Time decay simulation
   - Sensor reading simulation (gas, water, humidity)
   - Volunteer verification simulation
   - Real-time score updates
   - Perfect for judging demonstrations

5. **Sensor Data Visualization**
   - 24-hour hourly sensor readings
   - Interactive line graphs (Recharts)
   - Filterable by sensor type (gas, water, humidity)
   - Click-to-view specific time readings
   - Average calculations over 24 hours
   - Data source debugging information

6. **Chatbot Interface** (`/chatbot`)
   - Read-only assistant for queries
   - Answers questions about bathroom locations and status

### 🎨 UI/UX Features

- **Professional Design**: WHO-inspired color scheme and typography
- **Consistent Navigation**: Header and footer navigation across all pages
- **Responsive Design**: Works on desktop and mobile devices
- **Accessibility**: High contrast, clear typography, intuitive layout

## 🧱 Tech Stack

- **Frontend Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Backend/Database**: Supabase (PostgreSQL, Auth, Edge Functions)
- **Deployment**: Vercel
- **Styling**: TailwindCSS + shadcn/ui components
- **Data Visualization**: Recharts
- **State Management**: React hooks (useState, useEffect)

## 🚀 Installation & Setup

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- Supabase account ([sign up for free](https://supabase.com))

### Step 1: Clone the Repository

```bash
git clone <repository-url>
cd SanoCheck
```

### Step 2: Supabase Database Setup

1. **Create a Supabase Project**
   - Go to [supabase.com](https://supabase.com)
   - Create a new project
   - Wait for the database to initialize

2. **Run Database Schema**
   - In Supabase dashboard, go to **SQL Editor**
   - Copy and paste the contents of `supabase/schema.sql`
   - Click **Run** to execute

3. **Seed Initial Data** (Optional)
   - In SQL Editor, copy and paste `supabase/seed.sql`
   - Click **Run** to populate demo bathrooms

4. **Generate Sensor Data** (For Sensor Dashboard)
   - In SQL Editor, copy and paste `supabase/seed_sensor_data.sql`
   - Click **Run** to generate 24 hours of sensor data for A-03, A-11, C-05, D-06
   - This creates 72 readings per bathroom (24 gas + 24 water + 24 humidity)

5. **Get API Credentials**
   - Go to **Settings** → **API**
   - Copy your **Project URL** and **anon/public key**
   - Copy your **service_role key** (keep this secret!)

### Step 3: Environment Variables

1. **Copy the example environment file:**
   ```bash
   cp .env.example .env.local
   ```

2. **Edit `.env.local`** and add your Supabase credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
   ```

### Step 4: Install Dependencies

```bash
npm install
```

This will install all required packages including:
- Next.js 14
- React 18
- Supabase client
- TailwindCSS
- Recharts
- shadcn/ui components

### Step 5: Run Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

### Step 6: Verify Setup

1. Open `http://localhost:3000` in your browser
2. Navigate to **Admin** dashboard
3. You should see bathrooms with health scores
4. Navigate to **Sensor Data Dashboard** tab
5. Select a bathroom (A-03, A-11, C-05, or D-06) to view sensor graphs

## 🧪 Testing & Running

### Development Mode

```bash
npm run dev
```

- Hot reload enabled
- Accessible at `http://localhost:3000`
- All pages available for testing

### Production Build

```bash
npm run build
npm start
```

### Demo Flow for Judges

1. **Start the application**: `npm run dev`
2. **Navigate to Demo Mode** (`/demo`)
   - Select a bathroom from dropdown
   - Click "⏰ Simulate Time Decay" to advance time
   - Click sensor simulation buttons to add readings
   - Click "✅ Verify as Usable" or "❌ Mark as Unusable"
   - Watch scores update in real-time
3. **View Admin Dashboard** (`/admin`)
   - Check "Verification Queue" for prioritized bathrooms
   - Verify a bathroom and watch score recalculate
   - Go to "Sensor Data Dashboard" tab
   - Select a bathroom to view 24-hour sensor graphs
   - Click "📊 Load Data" to refresh sensor readings
4. **View Public Display** (`/public`)
   - Search for bathrooms
   - Add favorites using star icons
   - View zone-based organization
5. **Test Sensor Data**
   - In Admin → Sensor Data Dashboard
   - Select A-03, A-11, C-05, or D-06
   - View interactive graphs with 24 data points
   - Filter sensor types (gas, water, humidity)
   - Click graph points to see specific time readings

## 📊 System Architecture

```
┌─────────────────────────────────┐
│      Next.js App (Frontend)     │
│  - Pages (Admin, Public, Demo)  │
│  - API Routes (Server-side)      │
└──────────────┬──────────────────┘
               │
    ┌──────────┴──────────┐
    │                     │
┌───▼────┐          ┌─────▼─────┐
│  API   │          │  Pages    │
│ Routes │          │  Views    │
└───┬────┘          └───────────┘
    │
┌───▼────────────────────────────┐
│      Supabase Backend          │
│  - PostgreSQL Database         │
│  - Row Level Security (RLS)    │
│  - Real-time capabilities      │
└────────────────────────────────┘
```

### Core Components

1. **Scoring Engine** (`lib/scoring.ts`)
   - Rule-based, explainable logic
   - 0-3 whole number scale
   - Pure functions, no ML

2. **Database Layer** (`lib/db.ts`)
   - Supabase client abstraction
   - Automatic score recalculation
   - Sensor data fetching

3. **API Routes** (`app/api/`)
   - RESTful endpoints
   - Server-side data processing
   - Score recalculation triggers

4. **Frontend Pages**
   - Admin Dashboard (`/admin`)
   - Public Display (`/public`)
   - Demo Mode (`/demo`)
   - Chatbot (`/chatbot`)

## 🧮 Health Scoring System

### Scoring Scale: 0-3 (Whole Numbers Only)

The system uses a simple, transparent 0-3 scale where:
- **3** = Excellent condition
- **2** = Good condition
- **1** = Needs attention
- **0** = Unusable

### Scoring Rules

**Base Score**: Starts at 3

**Volunteer Verification** (Highest Authority):
- If volunteer marks unusable → Score = 0, Status = `verified_unusable`
- If volunteer verifies usable → Score remains high, Status = `verified_usable`
- Recent verification (< 24 hours) prevents time decay

**Sensor Readings** (All stored as percentages 0-100%):
- **Gas (H2S/NH3)**: High levels indicate poor air quality
  - Penalty applied if gas > threshold
- **Water Flow**: Low levels indicate no/low water
  - Penalty applied if water < threshold
- **Humidity**: High/low levels indicate ventilation issues
  - Penalty for humidity outside optimal range (30-60%)

**Time Decay**:
- Score decreases over time if not re-verified
- More days since last verification = larger penalty

**Status Derivation**:
1. If volunteer marked unusable → `verified_unusable`
2. If score < 2 → `flagged` (needs inspection)
3. Otherwise → `verified_usable`

### Key Principles

- **Volunteer verification is authoritative**: Only volunteers can mark bathrooms unusable
- **Sensor data affects priority**: Sensors influence score but don't override volunteer verification
- **Transparent rules**: All scoring logic is explainable and auditable
- **Time-based decay**: Encourages regular verification

## 📱 Pages & Features

### 1. Admin/Volunteer Dashboard (`/admin`)

**Tabs:**
- **Verification Queue**: Prioritized list of bathrooms needing inspection
  - Excludes bathrooms with score 3/3
  - Excludes `verified_unusable` bathrooms
  - Shows bathrooms with score < 3 or status = `flagged`
- **Maintenance Dispatch**: Create and manage maintenance requests
  - Issue types: Plumbing, Water Supply, Structural, Hygiene/Cleaning
  - Status tracking: Not Assigned, In Progress, Resolved
- **Sensor Data Dashboard**: Interactive sensor data visualization
  - Select bathroom to view 24-hour readings
  - Interactive line graphs (gas, water, humidity)
  - Filterable sensor types
  - Click graph points to view specific time readings
  - Average calculations displayed in cards

**Features:**
- Zone-based filtering
- Real-time score updates
- Verification forms
- Maintenance request creation
- All bathrooms registry view

### 2. Public Display (`/public`)

**Features:**
- Read-only view of usable bathrooms
- **Search functionality**: Filter by ID, zone, type, or location
- **Favorites system**: Save favorite bathrooms (localStorage)
- Zone-based organization
- Disclaimer about 24-hour data delay
- Contact information display (+967 770 755 368)
- Empty states for no results/no favorites

**Use Cases:**
- Public displays in community centers
- Information boards
- Non-interactive information sharing

### 3. Demo Mode (`/demo`)

**Simulation Controls:**
- ⏰ Time Decay: Advance all bathrooms by 5 days
- 🔥 Gas Sensor Spike: Add high gas reading
- 💧 Water Sensor Spike: Add low water reading
- 🌫️ Humidity Sensor Spike: Add high humidity reading
- ✅ Verify as Usable: Volunteer verification
- ❌ Mark as Unusable: Volunteer marks bathroom unusable

**Features:**
- Real-time score updates
- Visible state changes
- Interactive bathroom selection
- Current state display

### 4. Chatbot (`/chatbot`)

**Features:**
- Read-only assistant interface
- Answers queries about bathroom locations
- Simple chat UI

## 📡 API Endpoints

### Bathrooms
- `GET /api/bathrooms` - Get all bathrooms (with optional `?recalculate=true`)
- `GET /api/bathrooms/[id]` - Get specific bathroom details

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

### Sensor Data
- `GET /api/sensor-data/[id]` - Get 24-hour sensor readings for a bathroom
  - Returns: gas, water, humidity readings, averages, graph data
  - Includes debug information about data source

### Maintenance
- `GET /api/maintenance` - Get all maintenance requests
- `POST /api/maintenance` - Create maintenance request
- `PUT /api/maintenance/[id]` - Update maintenance status

### Rankings
- `GET /api/rankings` - Get prioritized bathroom list
- `GET /api/rankings?zone=A` - Get rankings for specific zone

### Demo
- `POST /api/demo/time-decay` - Simulate time decay
- `POST /api/demo/generate-sensor-data` - Generate sensor data (mock, refreshes display)

### Score Recalculation
- `GET /api/recalculate` - Manually trigger score recalculation for all bathrooms

## 🗄️ Database Schema

### Tables

1. **bathrooms**
   - `id` (TEXT, PRIMARY KEY)
   - `zone` (TEXT)
   - `type` (male/female/accessible)
   - `high_traffic` (BOOLEAN)
   - `sensor_attached` (BOOLEAN)
   - `health_score` (INTEGER, 0-3)
   - `status` (verified_usable/flagged/verified_unusable)
   - `location` (TEXT)
   - `last_verified_at` (TIMESTAMPTZ)
   - `created_at`, `updated_at` (TIMESTAMPTZ)

2. **verifications**
   - `id` (UUID, PRIMARY KEY)
   - `bathroom_id` (TEXT, FOREIGN KEY)
   - `volunteer_id` (TEXT)
   - `water_available` (BOOLEAN)
   - `clogged` (BOOLEAN)
   - `usable` (BOOLEAN)
   - `notes` (TEXT)
   - `created_at` (TIMESTAMPTZ)

3. **sensor_readings**
   - `id` (UUID, PRIMARY KEY)
   - `bathroom_id` (TEXT, FOREIGN KEY)
   - `sensor_type` (gas/water/humidity)
   - `gas_type` (H2S/NH3, only for gas sensors)
   - `value` (NUMERIC) - Stored as percentage (0-100%)
   - `unit` (TEXT) - '%'
   - `created_at` (TIMESTAMPTZ)

4. **maintenance_tasks**
   - `id` (UUID, PRIMARY KEY)
   - `bathroom_id` (TEXT, FOREIGN KEY)
   - `issue_type` (plumbing/water/structural/hygiene)
   - `status` (not_assigned/in_progress/resolved)
   - `contact_method` (phone/whatsapp/ticket)
   - `created_at`, `updated_at`, `resolved_at` (TIMESTAMPTZ)

### Row Level Security (RLS)

- Public read access for bathrooms and sensor readings
- Service role key used for writes and score recalculation
- Policies configured for anonymous and authenticated access

## 🗂️ Project Structure

```
SanoCheck/
├── app/
│   ├── api/                      # API routes
│   │   ├── bathrooms/
│   │   │   ├── [id]/route.ts
│   │   │   └── route.ts
│   │   ├── demo/
│   │   │   ├── generate-sensor-data/route.ts
│   │   │   └── time-decay/route.ts
│   │   ├── maintenance/
│   │   │   ├── [id]/route.ts
│   │   │   └── route.ts
│   │   ├── rankings/route.ts
│   │   ├── recalculate/route.ts
│   │   ├── sensor-data/
│   │   │   └── [id]/route.ts
│   │   ├── sensor-update/route.ts
│   │   └── verification/route.ts
│   ├── admin/page.tsx            # Admin dashboard
│   ├── chatbot/page.tsx          # Chatbot interface
│   ├── demo/page.tsx             # Demo mode
│   ├── public/page.tsx           # Public display
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Home page
│   └── globals.css               # Global styles
├── components/
│   └── ui/                       # shadcn/ui components
│       ├── badge.tsx
│       ├── button.tsx
│       ├── card.tsx
│       └── dialog.tsx
├── lib/
│   ├── db.ts                     # Database utilities
│   ├── scoring.ts                # Scoring engine (0-3 scale)
│   ├── supabase.ts               # Supabase client
│   ├── types.ts                  # TypeScript interfaces
│   └── utils.ts                  # Utility functions
├── supabase/
│   ├── schema.sql                # Database schema
│   ├── seed.sql                  # Initial demo data
│   ├── seed_sensor_data.sql      # 24-hour sensor data
│   └── migration_*.sql           # Database migrations
├── .env.example                  # Environment variables template
├── .env.local                    # Your environment variables (gitignored)
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── README.md
```

## 🔧 Configuration

### Environment Variables

Required in `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Database Migrations

If updating an existing database:

1. **Update to 0-3 scoring scale**: Run `supabase/migration_update_to_0_3_scale.sql`
2. **Update status constraints**: Run `supabase/migration_update_status_constraint.sql`
3. **Add sensor types**: Run `supabase/migration_sensor_types.sql`

### Generating Sensor Data

To generate 24 hours of sensor data for bathrooms:

1. Run `supabase/seed_sensor_data.sql` in Supabase SQL Editor
2. This creates data for: A-03, A-11, C-05, D-06
3. Each bathroom gets 72 readings (24 gas + 24 water + 24 humidity)
4. All values stored as percentages (0-100%)

## 🚀 Deployment

### Vercel Deployment

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Ready for deployment"
   git push origin main
   ```

2. **Import to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository
   - Vercel will auto-detect Next.js

3. **Add Environment Variables**
   - In Vercel project settings → Environment Variables
   - Add all three Supabase variables:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - `SUPABASE_SERVICE_ROLE_KEY`

4. **Deploy**
   - Click "Deploy"
   - Wait for build to complete
   - Your app will be live at `your-project.vercel.app`

### Supabase Setup

- Database is hosted on Supabase (no additional setup needed)
- RLS policies ensure data security
- All API calls go through Supabase client

## 📈 Scalability

### Current Implementation (MVP)
- Supabase PostgreSQL database
- Row Level Security enabled
- Serverless API routes (Vercel)
- Suitable for demo/judging and small-scale deployment

### Production Considerations

1. **Authentication & Authorization**
   - Add Supabase Auth integration
   - Role-based access control (volunteer, admin, maintenance)
   - Secure API endpoints with JWT verification

2. **Real-time Updates**
   - Supabase Realtime subscriptions
   - Push notifications for volunteers
   - Live score updates

3. **Performance**
   - Database indexing (already implemented)
   - API rate limiting
   - CDN for static assets (Vercel)

4. **Mobile App**
   - React Native with Supabase client
   - Offline support
   - Push notifications

5. **Analytics**
   - Usage tracking
   - Score trend analysis
   - Maintenance request analytics

## 📝 Credits & Attribution

### Technologies Used
- **Next.js**: React framework for production
- **Supabase**: Open-source Firebase alternative
- **TailwindCSS**: Utility-first CSS framework
- **shadcn/ui**: Re-usable component library
- **Recharts**: Composable charting library for React
- **Vercel**: Deployment platform

### Design Inspiration
- UI/UX design inspired by WHO (World Health Organization) website style
- Professional, muted color scheme
- High contrast for accessibility

## 📄 License

This project was built for the **CMUQ Lifelines 2026 Hackathon**.

Built as an MVP prototype for demonstration and judging purposes.

---

**Built with ❤️ for better sanitation access**
