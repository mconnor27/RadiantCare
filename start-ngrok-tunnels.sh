#!/bin/bash

# Start ngrok tunnel for backend (already running, but for reference)
# ngrok http --domain=unodored-bethanie-rambunctiously.ngrok-free.app 4000 &

# Start ngrok tunnel for frontend
# Replace YOUR-FRONTEND-DOMAIN with your reserved ngrok domain
ngrok http --domain=YOUR-FRONTEND-DOMAIN.ngrok-free.app 5173 &

echo "Ngrok tunnels started!"
echo "Backend: https://unodored-bethanie-rambunctiously.ngrok-free.app"
echo "Frontend: https://YOUR-FRONTEND-DOMAIN.ngrok-free.app"

