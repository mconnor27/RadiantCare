# Vercel Deployment Guide - Fixed Configuration

## 🔧 What Was Wrong

The original `vercel.json` had:
- Mixed `routes` and `rewrites` (conflicting syntax)
- Wrong path references (`/web/dist/` instead of root)
- Incorrect API routing

**Now fixed!** ✅

---

## 📁 Correct Project Structure for Vercel

Your repo should look like this:

```
/
├── api/                    # Serverless functions (auto-detected by Vercel)
│   ├── _lib/
│   ├── qbo/
│   ├── scenarios/
│   ├── health.ts
│   ├── package.json       # ✅ Must exist!
│   └── tsconfig.json
│
├── web/                    # Frontend (Vite/React)
│   ├── src/
│   ├── public/
│   ├── package.json
│   ├── vite.config.ts
│   └── index.html
│
└── vercel.json             # Deployment config
```

---

## 🚀 Deployment Steps

### Step 1: Push to GitHub

```bash
# Make sure everything is committed
git add .
git commit -m "Add serverless backend for Vercel deployment"
git push origin main
```

### Step 2: Connect to Vercel

Go to [vercel.com](https://vercel.com) and:

1. Click **"Add New..."** → **"Project"**
2. **Import** your GitHub repository
3. Configure project settings:

#### Framework Preset
- **Framework**: `Other` or `Vite`

#### Build & Development Settings
- **Root Directory**: `./` (leave as root)
- **Build Command**: Leave default (uses vercel.json)
- **Output Directory**: Leave default (uses vercel.json)
- **Install Command**: Leave default (uses vercel.json)

#### Environment Variables (CRITICAL!)

Add these in the **Environment Variables** section:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc... (Production only)
QBO_PRODUCTION_CLIENT_ID=ABxxx
QBO_PRODUCTION_CLIENT_SECRET=xxx
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
```

**Important:** 
- `VITE_*` variables are for the frontend (bundled into the app)
- Non-`VITE_*` variables are for serverless functions only

### Step 3: Deploy

Click **"Deploy"** and wait 2-3 minutes.

---

## 🎯 Option 1 vs Option 2: Local Testing Explained

### Option 1: Local Testing with Vercel CLI

**What it does:**
- Simulates Vercel's production environment on your computer
- Runs serverless functions locally at `http://localhost:3000/api/*`
- Hot-reloads your frontend on file changes
- Uses your local `.env.local` file

**When to use:**
- You want to test API endpoints before deploying
- You want to develop offline
- You want to catch errors early

**How to use:**
```bash
# Install Vercel CLI
npm install -g vercel

# Start local dev environment
cd /Users/Mike/RadiantCare
vercel dev

# Visit: http://localhost:3000
# API: http://localhost:3000/api/health
```

**What you get:**
- Frontend served from `web/dist/` (auto-rebuilds on changes)
- API functions running at `/api/*`
- Environment variables from `.env.local`
- Same behavior as production

---

### Option 2: Deploy Directly (No Local Testing)

**What it does:**
- Skips local testing entirely
- Deploys straight to Vercel's servers
- Tests in production or preview environment

**When to use:**
- You're confident your code works
- You don't need to test locally
- You want to test with real URLs and production environment

**How to use:**
```bash
# Just push to GitHub
git push origin main

# Vercel automatically deploys
# Test at: https://your-app.vercel.app
```

**What you get:**
- Automatic deployment on every git push
- Preview deployments for pull requests
- Production URL immediately
- Real production environment

---

## 🔍 Key Differences

| Feature | Option 1 (Local) | Option 2 (Direct Deploy) |
|---------|------------------|--------------------------|
| **Speed** | Instant (local) | 2-3 min deploy |
| **Environment** | Simulated | Real production |
| **Debugging** | Easy (local logs) | View in Vercel dashboard |
| **Internet** | Not required | Required |
| **Cost** | Free | Free (Hobby plan) |
| **API Testing** | `localhost:3000/api/*` | `your-app.vercel.app/api/*` |
| **Hot Reload** | Yes | No (requires redeploy) |
| **Environment Vars** | `.env.local` | Vercel dashboard |

---

## 🐛 Fixing Your 404 Error

Your 404 error is likely due to one of these:

### Issue 1: Missing API package.json
**Fixed!** ✅ I created `/api/package.json`

### Issue 2: Build Command Failed
Check Vercel deployment logs:
1. Go to your Vercel project
2. Click on the failed deployment
3. Look at the **Build Logs**

Common issues:
```bash
# Missing dependencies
npm install --prefix web

# TypeScript errors in frontend
cd web && npm run build

# Check for errors
```

### Issue 3: Environment Variables Not Set
Make sure you added all environment variables in Vercel dashboard!

### Issue 4: Wrong Root Directory
- Vercel should be set to root directory `./`
- NOT `web/` - the frontend is built FROM web/, but root is project root

---

## ✅ Verify Your Deployment

After deployment, test these URLs:

### 1. Frontend
```
https://your-app.vercel.app/
```
Should show your RadiantCare dashboard

### 2. API Health Check
```
https://your-app.vercel.app/api/health
```
Should return:
```json
{
  "ok": true,
  "timestamp": "2025-...",
  "service": "RadiantCare API"
}
```

### 3. Check Function Logs
In Vercel dashboard:
- Go to **Deployments** → Click your deployment
- Go to **Functions** tab
- See all your API endpoints listed
- Click any to see logs

---

## 🔄 Redeploy After Fixes

If you need to redeploy:

### Via GitHub
```bash
git add vercel.json
git commit -m "Fix Vercel configuration"
git push origin main
```
Vercel automatically redeploys!

### Via Vercel Dashboard
1. Go to your project
2. Click **"Redeploy"** on latest deployment
3. Check **"Use existing Build Cache"** (faster)

### Via Vercel CLI
```bash
vercel --prod
```

---

## 📊 Check Deployment Status

### In Vercel Dashboard

**Deployment Logs**
- See build output
- See function creation
- See any errors

**Function Logs**
- See runtime logs
- See invocation count
- See errors and stack traces

**Analytics**
- See page views
- See function invocations
- See performance metrics

---

## 🚨 Common Deployment Errors

### "Command failed: npm install"
**Fix:** Make sure `api/package.json` exists (✅ we just created it)

### "Build failed"
**Fix:** 
```bash
# Test build locally
cd web
npm install
npm run build
```

### "Function invocation failed"
**Fix:** Check environment variables are set in Vercel

### "Cannot find module '@supabase/supabase-js'"
**Fix:** Make sure `api/package.json` lists it as dependency (✅ it does)

---

## 📝 Deployment Checklist

Before deploying, verify:

- [ ] `api/package.json` exists ✅
- [ ] `web/package.json` exists ✅
- [ ] `vercel.json` exists ✅
- [ ] All code committed to git
- [ ] Pushed to GitHub
- [ ] Environment variables set in Vercel
- [ ] QuickBooks redirect URI updated
- [ ] Supabase redirect URLs updated

---

## 🎯 Recommended Workflow

1. **Develop locally** (Option 1):
   ```bash
   vercel dev
   # Make changes, test, iterate
   ```

2. **Commit and push**:
   ```bash
   git add .
   git commit -m "Add new feature"
   git push origin main
   ```

3. **Auto-deploy** (Option 2):
   - Vercel automatically deploys
   - Get preview URL immediately
   - Test in real environment

4. **Promote to production**:
   - If preview looks good, Vercel auto-promotes to production
   - Or manually promote in dashboard

---

## 💡 Pro Tips

### Preview Deployments
Every branch and PR gets its own URL:
```
main → https://your-app.vercel.app (production)
feature-branch → https://your-app-git-feature-branch.vercel.app (preview)
PR #5 → https://your-app-git-pr-5.vercel.app (preview)
```

### Environment Variables Per Environment
Set different values for:
- **Production**: Real QBO credentials
- **Preview**: Sandbox QBO credentials  
- **Development**: Local testing values

### Instant Rollback
If something breaks:
1. Go to **Deployments**
2. Find last working deployment
3. Click **"..."** → **"Promote to Production"**
4. Instant rollback!

---

## 🆘 Still Getting 404?

If you're still seeing 404 after fixing vercel.json:

1. **Check build logs** in Vercel dashboard
2. **Verify file structure** matches the layout above
3. **Make sure** `web/dist/index.html` is created during build
4. **Test build locally**:
   ```bash
   cd web
   npm run build
   ls dist/  # Should see index.html
   ```

5. **Share the error** from Vercel build logs and I'll help debug!

---

Need help? Share your:
- Vercel deployment URL
- Build logs (from Vercel dashboard)
- Any error messages

And I'll help you fix it! 🚀
