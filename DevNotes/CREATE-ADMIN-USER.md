# Create Admin User Guide

## Method 1: Via Supabase SQL Editor (Recommended)

### Step 1: Create the User Account

1. Go to https://supabase.com/dashboard
2. Open your project
3. Click **SQL Editor** in left sidebar
4. Click **+ New query**
5. Paste this SQL:

```sql
-- Create admin user with invitation
-- Replace YOUR_EMAIL with your actual email

-- Step 1: Create an invitation for yourself
INSERT INTO public.user_invitations (email, invitation_token, expires_at)
VALUES (
  'YOUR_EMAIL@example.com',  -- Replace with your email
  'ADMIN_SETUP_2025',         -- Your invitation token
  NOW() + INTERVAL '30 days'  -- Expires in 30 days
);

-- Step 2: You'll create the actual user via signup UI with this token
```

6. Click **Run** (bottom right)
7. You should see "Success. No rows returned"

### Step 2: Sign Up via the App

1. Go to your deployed app
2. Click **Sign In**
3. Click **Create account**
4. Enter:
   - Email: (the email you used above)
   - Invitation Code: `ADMIN_SETUP_2025` (case-sensitive!)
   - Password: (your password)
5. Click **Create Account**

### Step 3: Promote to Admin

Now that you have a regular user account, promote it to admin:

1. Go back to Supabase Dashboard
2. Click **SQL Editor**
3. Run this query:

```sql
-- Promote user to admin
-- Replace YOUR_EMAIL with your actual email
UPDATE public.profiles
SET is_admin = true
WHERE email = 'YOUR_EMAIL@example.com';

-- Verify it worked
SELECT id, email, is_admin, created_at 
FROM public.profiles 
WHERE email = 'YOUR_EMAIL@example.com';
```

4. You should see your profile with `is_admin: true`

### Step 4: Verify Admin Access

1. **Sign out** of your app (if logged in)
2. **Sign in again** with your credentials
3. Your profile should now have admin privileges
4. The QuickBooks sync button should work
5. You can now use `admin-interface.html` to create invitations

---

## Method 2: Via Supabase Dashboard (Quick but Less Clean)

### Step 1: Create Auth User

1. Go to **Authentication** → **Users** in Supabase Dashboard
2. Click **Add user** → **Create new user**
3. Enter:
   - Email: your-admin@example.com
   - Password: (your password)
   - Auto Confirm User: ✅ (check this!)
4. Click **Create user**
5. **Copy the User ID** (you'll need it next)

### Step 2: Create Profile

1. Go to **Table Editor** → **profiles**
2. Click **Insert** → **Insert row**
3. Enter:
   - `id`: (paste the User ID from Step 1)
   - `email`: your-admin@example.com
   - `full_name`: (optional)
   - `is_admin`: `true` ✅
   - (leave timestamps empty - they auto-populate)
4. Click **Save**

### Step 3: Sign In

1. Go to your app
2. Click **Sign In**
3. Enter your email and password
4. You're now signed in as admin!

---

## Method 3: Bootstrap Script (Advanced)

If you want to automate this, here's a SQL script:

```sql
-- Bootstrap first admin user
-- Run this ONCE in Supabase SQL Editor

DO $$ 
DECLARE
    new_user_id uuid;
    admin_email text := 'YOUR_ADMIN_EMAIL@example.com';  -- CHANGE THIS
BEGIN
    -- Generate UUID for the user
    new_user_id := gen_random_uuid();
    
    -- Create the auth user (Note: This creates a user but they MUST reset password)
    -- You'll need to use the "Send password recovery" feature
    INSERT INTO auth.users (
        id,
        instance_id,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        confirmation_token,
        email_change,
        email_change_token_new,
        recovery_token
    ) VALUES (
        new_user_id,
        '00000000-0000-0000-0000-000000000000',
        admin_email,
        crypt('TEMPORARY_CHANGE_ME', gen_salt('bf')),  -- Temporary password
        NOW(),
        '{"provider":"email","providers":["email"]}',
        '{}',
        NOW(),
        NOW(),
        '',
        '',
        '',
        ''
    );
    
    -- Create the profile with admin privileges
    INSERT INTO public.profiles (id, email, is_admin)
    VALUES (new_user_id, admin_email, true);
    
    RAISE NOTICE 'Admin user created with email: %', admin_email;
    RAISE NOTICE 'User ID: %', new_user_id;
    RAISE NOTICE 'You MUST reset the password before logging in!';
END $$;
```

**Then reset password:**
1. Go to Authentication → Users
2. Find your user
3. Click ⋯ → **Send password recovery**
4. Check your email and set a new password

---

## Verification Checklist

After creating your admin user:

- [ ] User exists in `auth.users` table
- [ ] Profile exists in `profiles` table with matching ID
- [ ] Profile has `is_admin = true`
- [ ] Can sign in to the app
- [ ] Email displays in header when signed in
- [ ] Can access admin-interface.html features
- [ ] QuickBooks sync button is enabled (not grayed out)

---

## Quick Test: Am I Admin?

To check if you're admin, you can run this in Supabase SQL Editor:

```sql
-- Check who is admin
SELECT 
  id,
  email,
  is_admin,
  created_at
FROM public.profiles
WHERE is_admin = true;
```

Or check in your app:
1. Sign in
2. Open browser console (F12)
3. Type: `localStorage`
4. Look for your Supabase session
5. Your profile should have `is_admin: true`

---

## Troubleshooting

### Issue: Can't sign in after creating user
**Solution:** Make sure `email_confirmed_at` is set in `auth.users` table. Use Method 1 or Method 2 with "Auto Confirm User" checked.

### Issue: Profile has `is_admin = false` after signup
**Solution:** The signup process creates profile from auth trigger. You must UPDATE it to set `is_admin = true` afterward.

### Issue: "User not found" error
**Solution:** Make sure the profile `id` exactly matches the auth.users `id`.

### Issue: Signed in but not seeing admin features
**Solution:** 
1. Sign out completely
2. Sign back in (to reload profile)
3. Check that profile has `is_admin = true` in database
4. Clear browser cache and try again

---

## Security Note

⚠️ **Important:** Only set `is_admin = true` for trusted users! Admin users can:
- Create user invitations
- View all users
- Promote/demote other users
- Access QuickBooks sync (global data)
- See all users' scenarios (via admin view)

Keep your admin credentials secure!

