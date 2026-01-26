# Quick Start Guide

## Installation & Run

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## First Steps

1. **Start with Demo Mode** (`/demo`)
   - See how the system works
   - Simulate events and watch scores update
   - Understand the scoring logic

2. **Try Admin Dashboard** (`/admin`)
   - View bathroom registry
   - Check the ranked to-do list
   - Verify a bathroom
   - Create a maintenance request

3. **Test Resident Dashboard** (`/resident`)
   - View usable bathrooms
   - Confirm bathroom status
   - Earn Community Helper badge

4. **Check Public Dashboard** (`/public`)
   - See read-only display
   - Zone-based listings

## Demo Flow for Judges

1. Go to `/demo`
2. Select bathroom "B-08" (currently unusable)
3. Click "✅ Volunteer: Usable" to verify it
4. Watch score jump from ~15 to ~85
5. Status changes from "❌ Verified unusable" to "✅ Verified usable"
6. Go to `/admin` and see it moved down the to-do list
7. Go to `/resident` and see it appears in usable bathrooms list
8. Click "I used this bathroom" and confirm
9. Score increases slightly (+2 bonus)
10. Go back to `/demo` and simulate gas spike (set to 60)
11. Score decreases by 20 points
12. Status may change to "⚠️ Needs recheck"

## Key Features to Demonstrate

- ✅ **Explainable Scoring**: Click on bathrooms to see why scores are what they are
- ✅ **Automatic Recalculation**: Scores update when data changes
- ✅ **Priority Ranking**: To-do list reorders based on multiple factors
- ✅ **Multiple Views**: Same data, different interfaces for different users
- ✅ **Mobile-Friendly**: Resident dashboard works on phones
- ✅ **No Black Box**: All scoring logic is transparent and configurable

## Troubleshooting

**Port 3000 already in use?**
```bash
# Use a different port
PORT=3001 npm run dev
```

**Dependencies not installing?**
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

**TypeScript errors?**
- Make sure you're using Node.js 18+
- Run `npm install` again
- Check that all files are saved
