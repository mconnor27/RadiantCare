# Vercel Dev Timeout Fix - Summary

## 🔴 Problem

`vercel dev` was timing out with error:
```
Error: Detecting port XXXXX timed out after 300000ms
```

The Vite dev server would start successfully on port 5174, but then Vercel would hang trying to detect an internal port for its serverless function handler.

## 🔍 Root Causes

1. **TypeScript compilation errors** in `/api/qbo/callback.ts` - Vercel couldn't compile the serverless functions
2. **Vercel CLI bug** - Known issue on macOS where port detection times out after 5 minutes
3. **Unnecessary complexity** - Using `vercel dev` for local development when a simpler approach exists

## ✅ Solutions Implemented

### 1. Fixed TypeScript Errors

**File:** `/Users/Mike/RadiantCare/api/qbo/callback.ts`

Added proper type definition for QuickBooks OAuth response:

```typescript
interface QBOTokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type?: string
  x_refresh_token_expires_in?: number
}

// Then cast the response
const json = await response.json() as QBOTokenResponse
```

This fixed 3 TypeScript errors that were preventing Vercel from compiling the API functions.

### 2. Created `.vercelignore`

**File:** `/Users/Mike/RadiantCare/.vercelignore`

Tells Vercel to ignore:
- `/server` directory (local Express server, not needed for deployment)
- Log files, Excel files, PSD files
- Documentation (except README.md)

This reduces what Vercel needs to process during builds.

### 3. Created `start-dev.sh` Script

**File:** `/Users/Mike/RadiantCare/start-dev.sh`

A simple bash script that:
1. Starts Express server on port 4000 (for API calls)
2. Starts Vite dev server on port 5174 (for frontend)
3. Handles cleanup when you press Ctrl+C

**Why this works:**
- Your `vite.config.ts` already has a proxy configured to forward `/api/*` requests to `localhost:4000`
- The Express server in `/server/index.js` has the same endpoints as the Vercel serverless functions
- No need for Vercel CLI during development

### 4. Documentation

Created three documentation files:
- **`DEV-SETUP.md`** - Comprehensive development setup guide
- **`QUICK-START.md`** - Quick reference for starting development
- **`VERCEL-DEV-FIX.md`** - This file (explains the problem and solution)

## 🎯 How to Use

### Local Development (Recommended)

```bash
./start-dev.sh
```

Access the app at http://localhost:5174

### Production Deployment

```bash
vercel --prod
```

This uses the `/api/*.ts` serverless functions, not the Express server.

## 📊 Architecture Comparison

### Before (Broken)
```
vercel dev → [timeout trying to start internal server]
     ↓
  [FAILS]
```

### After (Working)
```
Local Development:
Frontend (Vite :5174) → Express Server (:4000) → QuickBooks API

Production (Vercel):
Frontend (Static) → Vercel Functions (/api/*.ts) → QuickBooks API
```

## ⚠️ Important Notes

1. **Don't use `vercel dev` for local development** - Use `./start-dev.sh` instead
2. **The Express server (`/server`) is for local dev only** - Vercel ignores it in production
3. **The API functions (`/api/*.ts`) are for production only** - They're compiled serverless functions
4. **Both implement the same endpoints** - So your code works the same locally and in production

## 🐛 If You Still Have Issues

### Port conflicts
```bash
lsof -ti:4000 | xargs kill  # Kill Express
lsof -ti:5174 | xargs kill  # Kill Vite
```

### Check logs
```bash
tail -f dev-server.log  # Express server logs
```

### Verify environment variables
- Root: `.env` (for Express)
- Web: `web/.env.local` (for Vite)

## 🎉 Benefits

1. ✅ **Faster startup** - No Vercel CLI overhead
2. ✅ **More reliable** - No timeout issues
3. ✅ **Better debugging** - Direct access to server logs
4. ✅ **Simpler** - Just run one script
5. ✅ **Same behavior** - Works identically to production

## 📚 Related Files

- `web/vite.config.ts` - Contains proxy configuration
- `server/index.js` - Express server for local dev
- `api/` - Vercel serverless functions for production
- `vercel.json` - Vercel deployment configuration

