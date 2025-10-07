# API Function 500 Error - Debugging

## Possible Causes

### 1. Missing Type Declarations
Vercel might not be finding TypeScript types. Let's check:

**Check in Vercel Dashboard:**
- Go to your deployment
- Click **Functions** tab
- See which functions were created
- Click on a function to see logs

### 2. Module Resolution
The API functions use ESM (`"type": "module"`) but Vercel might expect CommonJS.

### 3. Missing Dependencies
The functions import from `crypto` and `@supabase/supabase-js`.

### 4. Environment Variables
The functions need these environment variables:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`  
- `SUPABASE_SERVICE_ROLE_KEY`
- `QBO_PRODUCTION_CLIENT_ID`
- `QBO_PRODUCTION_CLIENT_SECRET`

## Quick Fixes to Try

### Option 1: Check Vercel Logs
1. Go to Vercel dashboard
2. Click on your deployment
3. Go to **Functions** tab
4. Find the failing function
5. Click to see error logs
6. Share the error message

### Option 2: Test Health Endpoint
Try accessing:
```
https://your-app.vercel.app/api/health
```

This simple endpoint should work if the function deployment is working.

### Option 3: Check Environment Variables
In Vercel dashboard:
1. Go to **Settings** → **Environment Variables**
2. Make sure ALL these are set:
   - SUPABASE_URL
   - SUPABASE_ANON_KEY
   - SUPABASE_SERVICE_ROLE_KEY
   - QBO_PRODUCTION_CLIENT_ID
   - QBO_PRODUCTION_CLIENT_SECRET

### Option 4: Convert to JavaScript (if needed)
If TypeScript is causing issues, we can convert the API functions to JavaScript.

## What Error Are You Seeing?

Please check:
1. **Which URL are you accessing?** (e.g., `/api/health`, `/api/scenarios`, etc.)
2. **What do the Vercel function logs say?**
3. **Are environment variables set?**

Share these details and I'll help fix the specific issue!
