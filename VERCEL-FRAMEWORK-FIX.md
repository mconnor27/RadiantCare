# Fixing Vercel Framework Detection

## 🔍 The Problem

Vercel is detecting "Other" instead of "Vite" because:
- Your Vite project is in `web/` subdirectory
- Vercel looks at the root directory for framework detection
- It doesn't find `vite.config.ts` at root level

## ✅ The Fix (Two Options)

### Option 1: Update vercel.json (Already Done!)

I've added `"framework": "vite"` to your `vercel.json`:

```json
{
  "framework": "vite",
  "buildCommand": "cd web && npm install && npm run build",
  "outputDirectory": "web/dist",
  ...
}
```

**Now commit and push:**
```bash
cd /Users/Mike/RadiantCare
git add vercel.json
git commit -m "Set Vite framework in vercel.json"
git push origin main
```

Vercel will redeploy and use Vite optimizations!

---

### Option 2: Update in Vercel Dashboard

If you want to update the dashboard settings too (recommended for consistency):

1. Go to your Vercel project
2. Click **Settings** → **General**
3. Find **Framework Preset** section
4. Change from "Other" to **"Vite"**
5. Update these fields:

| Setting | Value |
|---------|-------|
| **Framework Preset** | Vite |
| **Root Directory** | `./` (keep as root - our vercel.json handles the subdirectory) |
| **Build Command** | Use vercel.json setting (leave override OFF) |
| **Output Directory** | Use vercel.json setting (leave override OFF) |
| **Install Command** | Use vercel.json setting (leave override OFF) |

6. Click **Save**
7. Click **Redeploy** on your latest deployment

---

## 🎯 Why This Matters

### With "Other" Framework:
- ❌ No Vite-specific optimizations
- ❌ Generic build process
- ⚠️ Might miss some features

### With "Vite" Framework:
- ✅ Vite-specific build optimizations
- ✅ Better caching strategies
- ✅ Faster builds
- ✅ Correct dev server behavior

---

## 🔄 About vercel.json vs Dashboard Settings

**The hierarchy:**
```
vercel.json settings > Dashboard overrides > Dashboard defaults
```

**What this means:**
- Settings in `vercel.json` take precedence
- Dashboard "Override" toggles can override vercel.json
- If override is OFF, vercel.json wins

**Best practice:**
- Define commands in `vercel.json` (version controlled!)
- Keep dashboard overrides OFF
- Only use dashboard for secrets/environment variables

---

## 📝 Your Current Setup (Correct!)

```
Root: /Users/Mike/RadiantCare/
├── vercel.json          # ✅ Has framework: "vite"
├── api/                 # Serverless functions (auto-detected)
│   └── package.json
└── web/                 # Vite frontend
    ├── vite.config.ts
    └── package.json
```

**Build flow:**
1. Vercel reads `vercel.json`
2. Sees `framework: "vite"`
3. Runs `installCommand`: Installs both api + web deps
4. Runs `buildCommand`: `cd web && npm run build`
5. Outputs to `web/dist/`
6. Serves static files + serverless functions

---

## 🐛 If You Still See "Configuration differs" Warning

This warning appears when:
- Dashboard settings don't match vercel.json
- Previous deployment used different settings

**To fix:**

### Method 1: Accept vercel.json Settings (Recommended)
1. Go to Vercel deployment page
2. Click the warning
3. Click **"Update Project Settings to match Production"**
4. This updates dashboard to match your vercel.json

### Method 2: Manual Update (if needed)
1. Go to **Settings** → **General**
2. Turn OFF all "Override" toggles:
   - ⚪ Build Command - Override OFF
   - ⚪ Output Directory - Override OFF
   - ⚪ Install Command - Override OFF
3. Set Framework Preset to "Vite"
4. Save

---

## 🎨 About .vercel in .gitignore

**Correct!** ✅ You should ignore `.vercel/` directory:

```gitignore
# .gitignore
.vercel/
```

**Why:**
- `.vercel/` contains local CLI cache
- Project linking information
- Should NOT be committed
- Each developer/environment has their own

**What to commit:**
- ✅ `vercel.json` - Project configuration
- ✅ `api/` - Your serverless functions
- ✅ `web/` - Your frontend code
- ❌ `.vercel/` - Local Vercel CLI data

---

## ✅ Quick Checklist

- [x] Added `"framework": "vite"` to vercel.json
- [ ] Commit and push the change
- [ ] Vercel automatically redeploys
- [ ] (Optional) Update dashboard Framework Preset to "Vite"
- [ ] (Optional) Click "Update Project Settings to match Production"
- [ ] Warning disappears!

---

## 🚀 Deploy the Fix Now

```bash
cd /Users/Mike/RadiantCare
git add vercel.json
git commit -m "Set Vite framework in Vercel config"
git push origin main

# Vercel will automatically redeploy with Vite framework
# Wait ~2 minutes, then check deployment
```

---

## 💡 Pro Tip

After this deploys, if you see the warning again:
1. Click the warning in Vercel dashboard
2. Click **"Update to match Production"**
3. It syncs dashboard → vercel.json
4. Warning gone forever! ✨

This ensures your dashboard and vercel.json are always in sync.
