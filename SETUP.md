# Quick Setup Guide

## Step 1: Supabase Setup

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Create a new project (choose a name and database password)
3. Wait for the project to be ready (takes ~2 minutes)

## Step 2: Database Schema

1. In your Supabase dashboard, go to **SQL Editor**
2. Click **New Query**
3. Copy the entire contents of `supabase/schema.sql`
4. Paste into the SQL Editor
5. Click **Run** (or press Ctrl+Enter)
6. You should see "Success. No rows returned"

## Step 3: Seed Data (Optional but Recommended)

1. Still in SQL Editor, click **New Query**
2. Copy the entire contents of `supabase/seed.sql`
3. Paste into the SQL Editor
4. Click **Run**
5. You should see "Success" messages

## Step 4: Get API Keys

1. In Supabase dashboard, go to **Settings** → **API**
2. Copy the following:
   - **Project URL** (under "Project URL")
   - **anon public** key (under "Project API keys")
   - **service_role** key (under "Project API keys" - keep this secret!)

## Step 5: Configure Environment

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Open `.env.local` and fill in your Supabase credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
   ```

## Step 6: Install and Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Troubleshooting

### "Missing Supabase environment variables"
- Make sure `.env.local` exists and has all three variables
- Restart the dev server after adding environment variables

### "relation does not exist"
- Make sure you ran `schema.sql` in Supabase SQL Editor
- Check that all tables were created (go to **Table Editor** in Supabase)

### "permission denied"
- Check that RLS policies were created (they're in `schema.sql`)
- Verify your API keys are correct

### Database connection issues
- Check that your Supabase project is active (not paused)
- Verify the project URL is correct (should end with `.supabase.co`)

## Next Steps

1. Visit `/demo` to test the system
2. Visit `/admin` to see the volunteer dashboard
3. Visit `/resident` to see the resident view
4. Visit `/public` to see the public display

## Deployment to Vercel

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com) and import your repository
3. Add the same environment variables in Vercel's project settings
4. Deploy!

The database is already hosted on Supabase, so no additional setup needed.
