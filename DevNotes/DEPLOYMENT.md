# RadiantCare Dashboard - Deployment Guide

## 🚀 Deploying to Vercel with Serverless Backend

This guide will walk you through deploying the RadiantCare Dashboard to Vercel with Supabase as the database.

---

## Prerequisites

- ✅ Completed Phase 1 (Supabase setup)
- ✅ Supabase project created and configured
- ✅ Admin user created and promoted
- ✅ GitHub account (recommended for automatic deployments)
- ✅ Vercel account (free tier works fine)

---

## Step 1: Prepare Your Repository

### 1.1 Install Dependencies

```bash
# Install root dependencies (for serverless functions)
npm install

# Install web dependencies
cd web
npm install
cd ..
```

### 1.2 Test Locally (Optional)

```bash
# Install Vercel CLI
npm install -g vercel

# Run local development server
vercel dev
```

This will start:
- Frontend on port 3000
- Serverless functions on `/api/*`

---

## Step 2: Configure Environment Variables

### 2.1 Create Local Environment File

Copy `env.example` to `.env.local` in the project root:

```bash
cp env.example .env.local
```

Fill in your Supabase and QuickBooks credentials:

```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

QBO_PRODUCTION_CLIENT_ID=ABxxxxx
QBO_PRODUCTION_CLIENT_SECRET=xxxxx
```

### 2.2 Create Web Environment File

Create `web/.env.local`:

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Step 3: Deploy to Vercel

### 3.1 Connect to Vercel

#### Option A: Using Vercel CLI (Recommended)

```bash
# Login to Vercel
vercel login

# Deploy
vercel
```

Follow the prompts:
- Set up and deploy? **Yes**
- Which scope? **Your account**
- Link to existing project? **No**
- Project name? **radiantcare-dashboard**
- Directory? **. (current directory)**
- Override settings? **No**

#### Option B: Using Vercel Dashboard

1. Go to [vercel.com](https://vercel.com)
2. Click "Add New..." → "Project"
3. Import your Git repository
4. Configure:
   - **Framework Preset**: Other
   - **Build Command**: `cd web && npm install && npm run build`
   - **Output Directory**: `web/dist`
   - **Install Command**: `npm install --prefix api && npm install --prefix web`

### 3.2 Configure Environment Variables in Vercel

Go to your project settings in Vercel:

1. **Settings** → **Environment Variables**
2. Add each variable from your `.env.local`:

| Name | Value | Environment |
|------|-------|-------------|
| `SUPABASE_URL` | Your Supabase URL | Production, Preview, Development |
| `SUPABASE_ANON_KEY` | Your anon key | Production, Preview, Development |
| `SUPABASE_SERVICE_ROLE_KEY` | Your service role key | Production only |
| `QBO_PRODUCTION_CLIENT_ID` | Your QBO client ID | Production only |
| `QBO_PRODUCTION_CLIENT_SECRET` | Your QBO secret | Production only |
| `VITE_SUPABASE_URL` | Your Supabase URL | Production, Preview, Development |
| `VITE_SUPABASE_ANON_KEY` | Your anon key | Production, Preview, Development |

3. Click **Save**

### 3.3 Redeploy

After adding environment variables:

```bash
vercel --prod
```

Or trigger a redeploy from the Vercel dashboard.

---

## Step 4: Configure QuickBooks Redirect URI

### 4.1 Get Your Vercel URL

After deployment, note your Vercel URL:
- `https://radiantcare-dashboard.vercel.app` (or similar)

### 4.2 Update QuickBooks App

1. Go to [developer.intuit.com](https://developer.intuit.com)
2. Sign in and select your QuickBooks app
3. Go to **Keys & OAuth**
4. Under **Redirect URIs**, add:
   ```
   https://radiantcare-dashboard.vercel.app/api/qbo/callback
   ```
5. Click **Save**

---

## Step 5: Update Supabase Configuration

### 5.1 Update Site URL

In Supabase dashboard:

1. Go to **Authentication** → **URL Configuration**
2. Update **Site URL**: `https://radiantcare-dashboard.vercel.app`
3. Add to **Redirect URLs**:
   ```
   https://radiantcare-dashboard.vercel.app
   https://radiantcare-dashboard.vercel.app/auth/callback
   ```

### 5.2 Update CORS (if needed)

In Supabase dashboard:

1. Go to **Settings** → **API**
2. Add your Vercel domain to **Allowed origins** if not already there

---

## Step 6: Test Your Deployment

### 6.1 Health Check

Visit: `https://radiantcare-dashboard.vercel.app/api/health`

Should return:
```json
{
  "ok": true,
  "timestamp": "2025-01-XX...",
  "service": "RadiantCare API"
}
```

### 6.2 Test Authentication

1. Open your app: `https://radiantcare-dashboard.vercel.app`
2. Try logging in with your admin account
3. Verify you can access the dashboard

### 6.3 Test QuickBooks Integration

1. As admin, go to QBO connection page
2. Click "Connect to QuickBooks"
3. Authorize the app
4. Verify you're redirected back successfully

### 6.4 Test Scenario Management

1. Create a test scenario
2. Save it to the database
3. List your scenarios
4. Load, edit, delete scenarios

---

## Step 7: Set Up Custom Domain (Optional)

### 7.1 Add Domain in Vercel

1. Go to **Settings** → **Domains**
2. Click **Add**
3. Enter your domain: `dashboard.radiantcare.com`
4. Follow DNS configuration instructions

### 7.2 Update Environment Variables

After adding custom domain:

1. Update QuickBooks redirect URI
2. Update Supabase site URL and redirect URLs
3. Update any hardcoded URLs in your code

---

## API Endpoints Reference

### Authentication
All API endpoints require authentication via Supabase JWT token in the `Authorization` header:

```
Authorization: Bearer <supabase-jwt-token>
```

### Available Endpoints

#### Health Check
```
GET /api/health
```

#### QuickBooks
```
GET  /api/qbo/connect?env=production
GET  /api/qbo/callback
POST /api/qbo/disconnect
POST /api/qbo/sync-2025
GET  /api/qbo/cached-2025
```

#### Scenarios
```
GET    /api/scenarios                    # List scenarios
POST   /api/scenarios                    # Create scenario
GET    /api/scenarios/:id                # Get single scenario
PUT    /api/scenarios/:id                # Update scenario
DELETE /api/scenarios/:id                # Delete scenario
POST   /api/scenarios/:id/clone          # Clone scenario
GET    /api/scenarios/public             # List public scenarios
```

---

## Troubleshooting

### Common Issues

#### "Function invocation failed" errors

**Cause**: Environment variables not set or function timeout

**Solution**:
1. Verify all environment variables are set in Vercel
2. Check function logs in Vercel dashboard
3. Increase function timeout if needed (Pro plan)

#### "Not connected" error on QBO sync

**Cause**: QBO tokens not stored or expired

**Solution**:
1. Reconnect QuickBooks via `/api/qbo/connect`
2. Check that tokens are being stored in Supabase
3. Verify `qbo_tokens` table has data

#### CORS errors

**Cause**: Supabase not allowing your domain

**Solution**:
1. Add your Vercel domain to Supabase allowed origins
2. Verify CORS headers in API responses
3. Check browser console for specific CORS errors

#### "Authentication required" errors

**Cause**: Supabase session not being sent or expired

**Solution**:
1. Clear browser cookies and re-login
2. Check that `Authorization` header is being sent
3. Verify Supabase JWT is valid

### Viewing Logs

#### Vercel Logs

```bash
vercel logs
```

Or view in dashboard: **Deployments** → Click deployment → **Functions** tab

#### Supabase Logs

Go to **Logs** section in Supabase dashboard:
- **API**: See database queries
- **Auth**: See authentication events
- **Functions**: See edge function logs (if used)

---

## Monitoring & Maintenance

### Performance Monitoring

Vercel provides built-in analytics:
- **Analytics** tab: View page views, visitors, etc.
- **Speed Insights**: Monitor Core Web Vitals
- **Function Logs**: Track API performance

### Database Maintenance

#### Regular Tasks

1. **Monitor database size**
   - Check Supabase dashboard for storage usage
   - Clean up old scenarios if needed

2. **Review QBO cache**
   - Cache updates daily during business days
   - Check `last_sync_timestamp` in `qbo_cache` table

3. **User management**
   - Review active users in admin dashboard
   - Clean up expired invitations

#### Backup Strategy

Supabase automatically backs up your database:
- Point-in-time recovery (paid plans)
- Manual backups via Supabase dashboard

For additional safety:
```sql
-- Export scenarios as JSON backup
SELECT json_agg(scenarios) FROM scenarios;
```

---

## Security Best Practices

### 1. Environment Variables

- ✅ Never commit `.env` files to Git
- ✅ Use Vercel secrets for sensitive data
- ✅ Rotate QuickBooks credentials regularly
- ✅ Use separate QBO apps for dev/prod

### 2. Database Security

- ✅ Row Level Security enabled on all tables
- ✅ Service role key only on server-side
- ✅ Regular security updates via Supabase

### 3. API Security

- ✅ All endpoints require authentication
- ✅ Admin endpoints check admin role
- ✅ Input validation on all endpoints
- ✅ Rate limiting via Vercel (Pro plan)

---

## Continuous Deployment

### Automatic Deployments

If using GitHub:

1. Push to `main` branch → Auto-deploy to production
2. Push to `develop` branch → Auto-deploy to preview
3. Pull requests → Auto-deploy to preview URLs

### Manual Deployments

```bash
# Deploy to production
vercel --prod

# Deploy to preview
vercel
```

---

## Cost Estimates

### Vercel (Hobby Plan - Free)
- ✅ 100 GB bandwidth/month
- ✅ Serverless functions
- ✅ Automatic HTTPS
- ✅ Custom domains

### Supabase (Free Plan)
- ✅ 500 MB database storage
- ✅ 50,000 monthly active users
- ✅ 2 GB bandwidth
- ✅ 500K Edge Function invocations

**Estimated monthly cost: $0** (for small teams with <10 users)

---

## Next Steps

After deployment:

1. ✅ Phase 1: Database setup ✓
2. ✅ Phase 2: Serverless backend ✓
3. 🔄 Phase 3: Frontend integration (Next!)
4. ⏳ Phase 4: Scenario Manager UI
5. ⏳ Phase 5: Testing & polish

Ready to proceed with **Phase 3: Frontend Integration**?
