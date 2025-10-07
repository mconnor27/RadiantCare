#!/bin/bash
# Set Supabase environment variables in Vercel
# Usage: ./set-vercel-env.sh

# Replace these with your actual values
SUPABASE_URL="https://your-project-id.supabase.co"
SUPABASE_ANON_KEY="your-anon-key-here"

echo "Setting environment variables in Vercel..."

vercel env add VITE_SUPABASE_URL production <<EOF
$SUPABASE_URL
EOF

vercel env add VITE_SUPABASE_ANON_KEY production <<EOF
$SUPABASE_ANON_KEY
EOF

echo "✅ Environment variables set!"
echo "Now run: vercel --prod"

