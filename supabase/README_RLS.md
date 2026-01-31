# Status updates not working?

If verification, resident feedback, or marking unusable **doesn't change bathroom status**, the API cannot write to the database (RLS blocking).

## 1. Test if writes work

With the app running (`npm run dev`), open in browser:

**http://localhost:3000/api/db-test**

- **`ok: true`** → Writes work. If status still doesn't update, check the browser Network tab when you submit verification.
- **`ok: false`** + `hint: Run supabase/migration_rls_allow_api_writes.sql` → Do step 2.

## 2. Run the RLS migration in Supabase

1. Open **Supabase Dashboard** → your project.
2. Go to **SQL Editor** → **New query**.
3. Open the file **`supabase/migration_rls_allow_api_writes.sql`** in your project and copy its **entire** contents.
4. Paste into the SQL Editor and click **Run**.
5. You should see "Success. No rows returned."
6. Call **http://localhost:3000/api/db-test** again; it should return **`ok: true`**.

## 3. Optional: use Service Role key (bypasses RLS)

In **`.env.local`** add:

```
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

Find the key in Supabase Dashboard → **Settings** → **API** → **service_role** (secret).  
Restart the dev server after changing `.env.local`.

After step 2 or 3, verification and resident feedback should persist and the Verification Queue should update.
