# NgrokSetup for RadiantCare

## Current Setup
- **Backend API**: `https://unodored-bethanie-rambunctiously.ngrok-free.app` (port 4000)
- **Frontend**: *To be configured* (port 5173 for dev, 4173 for preview)

## Steps to Set Up Frontend Ngrok Tunnel

### Option 1: Permanent Domain (Recommended)

If you have an ngrok paid/pro account:

1. **Reserve a domain** for the frontend:
   - Go to https://dashboard.ngrok.com/cloud-edge/domains
   - Click "New Domain" or "Reserve Domain"
   - Choose a subdomain (e.g., `radiantcare-frontend.ngrok-free.app`)
   - Copy the domain name

2. **Update the startup script**:
   - Edit `start-ngrok-tunnels.sh`
   - Replace `YOUR-FRONTEND-DOMAIN` with your reserved domain

3. **Start the frontend dev server**:
   ```bash
   cd /Users/Mike/RadiantCare/web
   npm run dev
   ```

4. **Start the ngrok tunnel** (in a separate terminal):
   ```bash
   ngrok http --domain=your-frontend-domain.ngrok-free.app 5173
   ```

5. **Access your app**:
   - Frontend: `https://your-frontend-domain.ngrok-free.app`
   - Backend API: `https://unodored-bethanie-rambunctiously.ngrok-free.app`

### Option 2: Free Ephemeral URL

If you don't have a paid plan:

1. **Start the frontend dev server**:
   ```bash
   cd /Users/Mike/RadiantCare/web
   npm run dev
   ```

2. **Start ngrok** (in a separate terminal):
   ```bash
   ./start-frontend-ngrok.sh
   ```
   or
   ```bash
   ngrok http 5173
   ```

3. **Copy the URL** that ngrok displays (e.g., `https://abc123.ngrok-free.app`)

4. **Share that URL** - Note: This URL changes every time you restart ngrok

## Production Build (Recommended for Sharing)

For better performance when sharing with others:

1. **Build the production version**:
   ```bash
   cd /Users/Mike/RadiantCare/web
   npm run build
   ```

2. **Preview the production build**:
   ```bash
   npm run preview
   ```
   (This runs on port 4173)

3. **Start ngrok for the preview**:
   ```bash
   ngrok http 4173
   ```
   or with permanent domain:
   ```bash
   ngrok http --domain=your-frontend-domain.ngrok-free.app 4173
   ```

## Keeping Tunnels Running Permanently

To keep ngrok tunnels running in the background:

### Using screen or tmux (macOS/Linux):

```bash
# Start a new screen session for backend
screen -S ngrok-backend
ngrok http --domain=unodored-bethanie-rambunctiously.ngrok-free.app 4000
# Press Ctrl+A, then D to detach

# Start a new screen session for frontend
screen -S ngrok-frontend
ngrok http --domain=your-frontend-domain.ngrok-free.app 5173
# Press Ctrl+A, then D to detach

# To reattach: screen -r ngrok-backend or screen -r ngrok-frontend
# To list sessions: screen -ls
```

### Using nohup (alternative):

```bash
nohup ngrok http --domain=your-frontend-domain.ngrok-free.app 5173 > ngrok-frontend.log 2>&1 &
```

## Troubleshooting

### "ngrok not found"
Install ngrok:
```bash
brew install ngrok
```
Or download from: https://ngrok.com/download

### "Domain already in use"
Stop the existing ngrok process:
```bash
pkill ngrok
```

### API calls not working
Make sure your backend server is running:
```bash
cd /Users/Mike/RadiantCare/server
npm start
```

### Ngrok browser warning
The backend already includes headers to bypass the warning. If you see it on the frontend, just click "Visit Site".

## Important Notes

- **Backend server** must be running on `localhost:4000`
- **Frontend dev server** must be running on `localhost:5173`
- Your **API calls** will proxy through the frontend to the backend via `/api/*` routes
- The frontend can access the backend using relative URLs (e.g., `/api/qbo/connect`)

