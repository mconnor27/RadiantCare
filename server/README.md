# RadiantCare Server (QuickBooks OAuth)

## Setup

1. **Configure ngrok** (required for QuickBooks OAuth):
   ```bash
   ngrok config add-authtoken 331X5P05igT7mydsXCBzszy0eYw_2Z3mf3c4TqrniobFLPwt8
   ```

2. **Start ngrok tunnel**:
   ```bash
   ngrok http --url=unodored-bethanie-rambunctiously.ngrok-free.app 4000
   ```

3. **Create `server/.env`** with your QuickBooks app credentials:
   ```
   PORT=4000

   # Production QuickBooks App Credentials
   QBO_PRODUCTION_CLIENT_ID=your_production_client_id_here
   QBO_PRODUCTION_CLIENT_SECRET=your_production_client_secret_here

   # Sandbox QuickBooks App Credentials (optional)
   QBO_SANDBOX_CLIENT_ID=your_sandbox_client_id_here
   QBO_SANDBOX_CLIENT_SECRET=your_sandbox_client_secret_here

   QBO_REDIRECT_URI=https://unodored-bethanie-rambunctiously.ngrok-free.app/api/qbo/callback
   ```

4. **Install and run**:
   ```bash
   npm install --prefix server
   npm run dev --prefix server
   ```

## QuickBooks App Configuration

In your QuickBooks Developer app settings, set the Redirect URI to:
```
https://unodored-bethanie-rambunctiously.ngrok-free.app/api/qbo/callback
```


