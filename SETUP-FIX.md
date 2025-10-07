# Quick Setup Fix

## Fix npm cache permissions issue

Run these commands in your terminal:

```bash
# Fix npm cache ownership (requires password)
sudo chown -R 501:20 "/Users/Mike/.npm"

# Clean npm cache
npm cache clean --force

# Install API dependencies
cd /Users/Mike/RadiantCare
npm install --prefix api

# Install Vercel CLI globally
npm install -g vercel

# OR install locally if you don't want global install
npm install --save-dev vercel
npx vercel dev  # Use npx to run local vercel
```

## Alternative: Skip Vercel CLI for now

If you want to skip local testing and deploy directly:

```bash
# Just install API dependencies
npm install --prefix api

# Deploy directly to Vercel (no CLI needed)
# Go to vercel.com, import your repo, and deploy via dashboard
```

## After fixing permissions

```bash
# Test that everything is installed
cd /Users/Mike/RadiantCare
npm install --prefix api

# You should see: "added X packages" without errors
```

## Next Steps

Once dependencies are installed:

1. **If you want to test locally:**
   ```bash
   vercel dev
   # API will be at http://localhost:3000/api/*
   ```

2. **If you want to deploy to production:**
   - Go to [vercel.com](https://vercel.com)
   - Import your GitHub repo
   - Configure environment variables
   - Deploy!

3. **Continue to Phase 3:**
   - We can proceed with frontend integration whether or not you test locally
   - The serverless functions will work the same locally or in production

