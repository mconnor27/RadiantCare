# RadiantCare Quick Start Guide

## 🔧 First Time Setup

**Run this once to set up your environment variables:**

```bash
./setup-env.sh
```

This will prompt you for your Supabase credentials and create:
- `.env` (for Express server)
- `web/.env.local` (for Vite frontend)

Get your Supabase credentials from: https://supabase.com/dashboard → Your Project → Settings → API

## 🚀 Starting Development

After setup, simply run:

```bash
./start-dev.sh
```

This starts both servers:
- **Frontend (Vite)**: http://localhost:5174
- **Backend (Express)**: http://localhost:4000

Press `Ctrl+C` to stop both servers.

## 🛠️ What Was Fixed

The `vercel dev` command was timing out due to a known Vercel CLI bug on macOS. Instead, we now:

1. Run the Express server directly (handles API calls and QuickBooks OAuth)
2. Run the Vite dev server (React frontend with hot reload)
3. Vite proxies `/api/*` requests to Express automatically

This is **faster**, **more reliable**, and avoids the Vercel CLI timeout issues.

## ⚙️ Alternative: Manual Start

If you prefer to see output in separate terminals:

**Terminal 1 - Backend:**
```bash
cd server
node index.js
```

**Terminal 2 - Frontend:**
```bash
cd web
npm run dev
```

## 📝 Important Files

- **`start-dev.sh`** - Main development startup script
- **`DEV-SETUP.md`** - Detailed development setup documentation
- **`vercel.json`** - Vercel production deployment config
- **`.vercelignore`** - Tells Vercel to ignore local dev files

## 🐛 Troubleshooting

### "Port already in use"

```bash
# Kill Express server (port 4000)
lsof -ti:4000 | xargs kill

# Kill Vite server (port 5174)
lsof -ti:5174 | xargs kill
```

### Check server logs

```bash
# Watch Express server logs
tail -f dev-server.log

# Vite logs appear in the terminal
```

### Environment variables missing

**Solution:** Run the setup script:
```bash
./setup-env.sh
```

Or manually create:
- `.env` in the root (for Express server)
- `web/.env.local` (for Vite/React app)

See `env.example` for required variables format.

**Quick fix if you have credentials:**
```bash
# Create .env in root
cat > .env << 'EOF'
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
PORT=4000
EOF

# Create web/.env.local
cat > web/.env.local << 'EOF'
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
EOF
```

## 🚀 Production Deployment

For production, use Vercel:

```bash
vercel --prod
```

This uses the `/api/*.ts` serverless functions (NOT the Express server).

## 📚 More Info

- Full setup guide: **`DEV-SETUP.md`**
- API Reference: **`API-REFERENCE.md`**
- Deployment: **`VERCEL-DEPLOYMENT-GUIDE.md`**

