# RadiantCare Development Setup

## Quick Start

To run the development environment, simply execute:

```bash
./start-dev.sh
```

This will start:
- **Express API server** on port 4000 (handles QuickBooks OAuth and API calls)
- **Vite frontend server** on port 5174 (React app with hot reload)

Vite automatically proxies `/api/*` requests to the Express server, so everything works seamlessly.

## Why Not `vercel dev`?

You might wonder why we don't use `vercel dev`. Here's the situation:

- `vercel dev` has a known bug on macOS where it times out detecting internal ports
- It tries to run both the frontend AND compile TypeScript serverless functions, which is slow
- For local development, the Express server (`/server`) is simpler and faster
- The Express server has the same API endpoints as the Vercel functions

## Architecture

### Local Development
```
Frontend (Vite) → Express Server → QuickBooks API
   :5174              :4000
```

The frontend makes requests to `/api/*` which Vite proxies to the Express server on port 4000.

### Production (Vercel)
```
Frontend (Static) → Vercel Serverless Functions → QuickBooks API
                        /api/*.ts
```

In production, Vercel serves the static frontend and handles `/api/*` requests with serverless functions.

## Environment Variables

Make sure you have a `.env` file in the root with:
```bash
# Supabase
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# QuickBooks OAuth
QBO_PRODUCTION_CLIENT_ID=...
QBO_PRODUCTION_CLIENT_SECRET=...
QBO_SANDBOX_CLIENT_ID=...
QBO_SANDBOX_CLIENT_SECRET=...
QBO_REDIRECT_URI=... # For ngrok/local testing

# Port (optional, defaults to 4000)
PORT=4000
```

And a `web/.env.local` with:
```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## Manual Start (Alternative)

If you prefer to start servers separately:

```bash
# Terminal 1: Start Express server
cd server
node index.js

# Terminal 2: Start Vite frontend
cd web
npm run dev
```

## Troubleshooting

### Port Already in Use

If you get "port already in use" errors:

```bash
# Find and kill process on port 4000
lsof -ti:4000 | xargs kill

# Find and kill process on port 5174
lsof -ti:5174 | xargs kill
```

### API Calls Failing

1. Make sure the Express server is running on port 4000
2. Check `dev-server.log` for errors
3. Verify your `.env` file has all required variables

### Vercel Deployment

To deploy to Vercel (for production):

```bash
vercel --prod
```

This uses the `/api/*.ts` serverless functions, not the Express server.

