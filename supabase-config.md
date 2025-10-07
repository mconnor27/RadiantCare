# Supabase Setup Instructions

## Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up/login
2. Click "New Project"
3. Choose your organization
4. Set project name: `radiantcare-dashboard`
5. Set database password (save this securely)
6. Choose region (closest to your users)
7. Click "Create new project"

## Step 2: Get Project Credentials

Once your project is created, go to **Settings > API**:

- **Project URL**: `https://your-project-id.supabase.co`
- **Anon/Public Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (public key)
- **Service Role Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (secret key - keep secure!)

## Step 3: Configure Authentication

Go to **Authentication > Settings**:

### Site URL Configuration
- **Site URL**: `http://localhost:5173` (for development)
- **Additional Redirect URLs**: 
  - `http://localhost:5173/auth/callback`
  - `https://your-app.vercel.app` (add after deployment)
  - `https://your-app.vercel.app/auth/callback`

### Auth Providers
- **Enable Email**: ✅ Enabled
- **Disable Email Confirmations**: ❌ (keep enabled for security)
- **Enable Phone**: ❌ (not needed)

### Advanced Settings
- **Enable database webhooks**: ✅ (for user creation trigger)
- **Enable custom SMTP**: ❌ (use Supabase SMTP for now)

### Security Settings
- **Enable RLS**: ✅ (already enabled by our SQL)
- **JWT expiry**: 3600 seconds (1 hour)
- **Refresh token rotation**: ✅ Enabled

## Step 4: Disable Public Registration

Go to **Authentication > Settings > Auth**:

- **Enable email confirmations**: ✅ Keep enabled
- **Enable phone confirmations**: ❌ Not needed
- **Enable manual linking**: ❌ Not needed

**IMPORTANT**: In the **Auth** section, find **"Enable signup"** and **DISABLE** it. This prevents public registration.

## Step 5: Run Database Setup

1. Go to **SQL Editor** in your Supabase dashboard
2. Create a new query
3. Copy and paste the entire contents of `supabase-setup.sql`
4. Click **Run** to execute the setup

## Step 6: Create Your First Admin User

After running the SQL setup, you need to create your first admin invitation manually:

```sql
-- Replace with your actual email
INSERT INTO public.user_invitations (email, invitation_token, expires_at)
VALUES ('mike@radiantcare.com', 'admin-setup-token-123', NOW() + INTERVAL '30 days');
```

## Step 7: Sign Up as Admin

1. Go to your app's signup page: `http://localhost:5173/signup?invitation=admin-setup-token-123`
2. Sign up with your email and password
3. After signup, promote yourself to admin in the SQL Editor:

```sql
-- Replace with your actual email
UPDATE public.profiles SET is_admin = TRUE WHERE email = 'mike@radiantcare.com';
```

## Step 8: Environment Variables

Create a `.env.local` file in your `web/` directory:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# For serverless functions (add to Vercel later)
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Step 9: Test Database Setup

You can test your setup by running these queries in the SQL Editor:

```sql
-- Check if tables were created
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Check RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public';

-- Check your admin user
SELECT * FROM public.profiles WHERE is_admin = TRUE;

-- Check pending invitations
SELECT * FROM public.pending_invitations;
```

## Admin Functions Available

Once you're set up as an admin, you can use these functions:

### Create User Invitation
```sql
-- Creates invitation that expires in 7 days (default)
SELECT public.create_user_invitation('user@example.com');

-- Creates invitation that expires in 30 days
SELECT public.create_user_invitation('user@example.com', 30);
```

### Get Invitation URL
```sql
-- Get the signup URL for an invitation
SELECT public.get_invitation_url('invitation-uuid-here');
```

### View Admin Dashboard Data
```sql
-- See all users and their stats
SELECT * FROM public.admin_user_overview;

-- See pending invitations
SELECT * FROM public.pending_invitations;
```

## Security Features

✅ **Admin-only registration**: Users can only sign up with valid invitations
✅ **Row Level Security**: Users can only access their own data
✅ **Admin controls**: Only admins can create invitations and manage QBO data
✅ **Invitation expiry**: Invitations automatically expire after set time
✅ **Email verification**: Users must verify their email addresses
✅ **JWT tokens**: Secure authentication with automatic refresh

## Next Steps

After completing this setup:

1. ✅ Database and auth configured
2. 🔄 Create serverless API functions (Phase 2)
3. 🔄 Build frontend auth components (Phase 3)
4. 🔄 Build scenario manager UI (Phase 4)
5. 🔄 Deploy to Vercel (Phase 5)

## Troubleshooting

### Common Issues

**"Registration requires a valid invitation"**
- Make sure you created an invitation first
- Check that the invitation hasn't expired
- Verify the invitation token in the URL

**RLS Policy Errors**
- Make sure you ran the complete SQL setup
- Check that the user has been promoted to admin
- Verify the policies exist: `SELECT * FROM pg_policies WHERE schemaname = 'public';`

**Auth Redirect Issues**
- Check Site URL and Redirect URLs in Supabase Auth settings
- Make sure URLs match exactly (including http/https)
- Clear browser cache and cookies

### Getting Help

If you encounter issues:
1. Check the Supabase logs in **Logs > Auth**
2. Check browser console for errors
3. Verify environment variables are correct
4. Test database queries in SQL Editor
