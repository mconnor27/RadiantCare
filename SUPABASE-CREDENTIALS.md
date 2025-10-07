# How to Get Your Supabase Credentials

## Finding Your Supabase URL and Keys

### Step 1: Go to Your Supabase Project

1. Visit https://supabase.com/dashboard
2. Click on your project (the one you created in Phase 1)

### Step 2: Get Project URL and Keys

1. In the left sidebar, click **Settings** (⚙️ icon at bottom)
2. Click **API** in the settings menu
3. You'll see:

   **Project URL:**
   ```
   https://xxxxxxxxxxxxx.supabase.co
   ```
   Copy this entire URL (including `https://`)

   **Project API keys:**
   - `anon` `public` key - This is your `SUPABASE_ANON_KEY`
   - `service_role` `secret` key - This is your `SUPABASE_SERVICE_ROLE_KEY`

### Step 3: Set Environment Variables in Vercel

You need to set **BOTH** backend and frontend variables:

#### Backend Variables (for API functions)
```bash
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Frontend Variables (for Vite/React)
```bash
VITE_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Note:** The frontend uses `VITE_` prefix because Vite only exposes variables starting with `VITE_` to the client-side code.

### Step 4: Set in Vercel

**Via Dashboard:**
1. Go to https://vercel.com/dashboard
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Add each variable one by one
5. For each variable, check **Production**, **Preview**, and **Development**
6. Click **Save**

**After adding all variables, you MUST redeploy:**
1. Go to **Deployments** tab
2. Click the ⋯ menu on the latest deployment
3. Click **Redeploy**
4. Or just push a new commit to trigger auto-deploy

### Step 5: Verify

After redeployment, check your app:
1. Open the deployed URL
2. Open browser console (F12)
3. Should NOT see any Supabase URL errors
4. Try clicking "Sign In" button
5. Login modal should appear without errors

## Common Issues

### Issue: "Invalid supabaseUrl: Must be a valid HTTP or HTTPS URL"
**Cause:** Environment variables not set or missing `https://`
**Fix:** 
- Make sure URL includes `https://`
- Redeploy after setting variables
- Clear browser cache

### Issue: "Missing Supabase environment variables"
**Cause:** Variables not set or wrong names
**Fix:**
- Double-check variable names (case-sensitive!)
- Frontend needs `VITE_` prefix
- Backend needs no prefix

### Issue: Environment variables don't update
**Cause:** Vercel caches build output
**Fix:**
- Must redeploy after changing env vars
- Variables are baked into build at build-time
- Just saving env vars isn't enough!

## Quick Checklist

- [ ] Found Supabase Project URL (includes `https://`)
- [ ] Found Supabase Anon Key (starts with `eyJ...`)
- [ ] Found Supabase Service Role Key (starts with `eyJ...`)
- [ ] Set `SUPABASE_URL` in Vercel
- [ ] Set `SUPABASE_ANON_KEY` in Vercel
- [ ] Set `SUPABASE_SERVICE_ROLE_KEY` in Vercel
- [ ] Set `VITE_SUPABASE_URL` in Vercel (same as SUPABASE_URL)
- [ ] Set `VITE_SUPABASE_ANON_KEY` in Vercel (same as SUPABASE_ANON_KEY)
- [ ] Set `QBO_PRODUCTION_CLIENT_ID` in Vercel
- [ ] Set `QBO_PRODUCTION_CLIENT_SECRET` in Vercel
- [ ] Redeployed after setting variables
- [ ] Tested app in browser (no console errors)
- [ ] Can open login modal without errors

## Example Values

```bash
# These are EXAMPLES - use your actual values!
SUPABASE_URL=https://abcdefghijklmnop.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTY5MDAwMDAwMCwiZXhwIjoyMDA1NTc2MDAwfQ.1234567890abcdefghijklmnopqrstuvwxyz
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNjkwMDAwMDAwLCJleHAiOjIwMDU1NzYwMDB9.0987654321zyxwvutsrqponmlkjihgfedcba

# Frontend (same values, different names)
VITE_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTY5MDAwMDAwMCwiZXhwIjoyMDA1NTc2MDAwfQ.1234567890abcdefghijklmnopqrstuvwxyz
```

## Need Help?

If you're still having issues:

1. **Check Vercel Build Logs:**
   - Go to Deployments → Click on deployment → View Function Logs
   - Look for "Missing Supabase environment variables" error

2. **Check Browser Console:**
   - Open your deployed app
   - Press F12 to open DevTools
   - Look for Supabase-related errors

3. **Test API Endpoint:**
   ```bash
   curl https://your-app.vercel.app/api/health
   ```
   Should return: `{"ok":true,"timestamp":"...","service":"RadiantCare API"}`

4. **Verify Variables Are Set:**
   - In Vercel Dashboard → Settings → Environment Variables
   - Should see all 7 variables listed
   - Click "Redacted" to verify they're not empty

