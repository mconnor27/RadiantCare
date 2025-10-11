#!/bin/bash
# RadiantCare Development Server Startup Script
# This script starts both the Express backend (port 4000) and Vite frontend (port 5174)

# Get the directory where this script lives
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "🚀 Starting RadiantCare Development Environment..."
echo "   Working directory: $SCRIPT_DIR"
echo ""

# Function to cleanup background processes on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down servers..."
    kill $EXPRESS_PID $VITE_PID 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

# Start Express server in background
echo "📡 Starting Express API server on port 4000..."
(cd server && node index.js) > dev-server.log 2>&1 &
EXPRESS_PID=$!

# Wait a moment for Express to start
sleep 2

# Check if Express started successfully
if ! kill -0 $EXPRESS_PID 2>/dev/null; then
    echo "❌ Failed to start Express server"
    echo "   Check dev-server.log for errors"
    cat dev-server.log
    exit 1
fi

echo "✅ Express server started (PID: $EXPRESS_PID)"
echo ""

# Start Vite dev server
echo "🎨 Starting Vite frontend server on port 5174..."
(cd web && npm run dev) &
VITE_PID=$!

echo ""
echo "✅ Development servers started!"
echo ""
echo "   Frontend: http://localhost:5174"
echo "   Backend:  http://localhost:4000"
echo ""
echo "   Express log: tail -f dev-server.log"
echo ""
echo "Press Ctrl+C to stop all servers"
echo ""

# Wait for both processes
wait $EXPRESS_PID $VITE_PID

