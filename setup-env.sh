#!/bin/bash
# Setup local environment variables for RadiantCare development

echo "🔧 RadiantCare Environment Setup"
echo ""
echo "You need your Supabase credentials to continue."
echo "Get them from: https://supabase.com/dashboard → Your Project → Settings → API"
echo ""

# Function to prompt for input
prompt_for() {
    local var_name=$1
    local description=$2
    local current_value=$3
    
    if [ -n "$current_value" ]; then
        echo "✓ $var_name is already set"
        return 0
    fi
    
    echo -n "$description: "
    read value
    
    if [ -z "$value" ]; then
        echo "❌ Cannot be empty!"
        return 1
    fi
    
    eval "$var_name='$value'"
    return 0
}

echo "===================="
echo "STEP 1: Supabase Credentials"
echo "===================="
echo ""

# Prompt for Supabase URL
while true; do
    prompt_for SUPABASE_URL "Enter your Supabase URL (https://xxxxx.supabase.co)" "" && break
done

# Prompt for Anon Key
while true; do
    prompt_for SUPABASE_ANON_KEY "Enter your Supabase Anon Key (starts with eyJ...)" "" && break
done

# Prompt for Service Role Key  
while true; do
    prompt_for SUPABASE_SERVICE_ROLE_KEY "Enter your Supabase Service Role Key (starts with eyJ...)" "" && break
done

echo ""
echo "===================="
echo "STEP 2: QuickBooks OAuth (Optional)"
echo "===================="
echo "Press Enter to skip if you don't have these yet"
echo ""

read -p "QuickBooks Production Client ID (optional): " QBO_PROD_CLIENT_ID
read -p "QuickBooks Production Client Secret (optional): " QBO_PROD_SECRET
read -p "QuickBooks Sandbox Client ID (optional): " QBO_SANDBOX_CLIENT_ID
read -p "QuickBooks Sandbox Client Secret (optional): " QBO_SANDBOX_SECRET

echo ""
echo "===================="
echo "Creating environment files..."
echo "===================="

# Create root .env file (for Express server)
cat > .env << EOF
# Supabase Configuration
SUPABASE_URL=$SUPABASE_URL
SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY

# QuickBooks OAuth - Production
QBO_PRODUCTION_CLIENT_ID=${QBO_PROD_CLIENT_ID:-your-production-client-id}
QBO_PRODUCTION_CLIENT_SECRET=${QBO_PROD_SECRET:-your-production-client-secret}

# QuickBooks OAuth - Sandbox
QBO_SANDBOX_CLIENT_ID=${QBO_SANDBOX_CLIENT_ID:-your-sandbox-client-id}
QBO_SANDBOX_CLIENT_SECRET=${QBO_SANDBOX_SECRET:-your-sandbox-client-secret}

# QuickBooks Redirect URI (for ngrok/local testing)
QBO_REDIRECT_URI=http://localhost:4000/api/qbo/callback

# Server Port
PORT=4000
EOF

echo "✅ Created .env"

# Create web/.env.local file (for Vite frontend)
cat > web/.env.local << EOF
# Supabase Configuration (Frontend)
VITE_SUPABASE_URL=$SUPABASE_URL
VITE_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
EOF

echo "✅ Created web/.env.local"

echo ""
echo "===================="
echo "✅ Setup Complete!"
echo "===================="
echo ""
echo "Environment files created:"
echo "  • .env (for Express server)"
echo "  • web/.env.local (for Vite frontend)"
echo ""
echo "Next steps:"
echo "  1. Run: ./start-dev.sh"
echo "  2. Open: http://localhost:5174"
echo ""
echo "Note: QuickBooks OAuth will only work after you set up ngrok"
echo "      See NGROK_SETUP.md for details"
echo ""

