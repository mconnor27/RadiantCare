# Admin Interface Guide

## Overview

`admin-interface.html` is a standalone admin dashboard for managing users and invitations. It's currently a **local-only** HTML file, but can be deployed.

## 🔒 Security Model

### How It's Protected

The admin interface uses **Supabase Row Level Security (RLS)** to protect admin actions:

1. **Authentication Required:** User must be signed in
2. **Admin Check:** RLS policies verify `is_admin = true` in database
3. **Database-Level Security:** Even if someone accesses the file, they can't perform admin actions without proper credentials

### What Admins Can Do

- Create user invitations
- View all users and their roles
- Promote/demote users to/from admin
- See invitation status (used/unused, expired)

### What Non-Admins See

If a non-admin user signs in to the admin interface:
- Can see the UI
- **Cannot** create invitations (RLS blocks it)
- **Cannot** modify user roles (RLS blocks it)
- **Cannot** view other users' data (RLS blocks it)

## 📍 Current Status: Local Only

### Why It's Local

The file currently has placeholder Supabase credentials:

```javascript
// Line 261-262 in admin-interface.html
const SUPABASE_URL = 'YOUR_SUPABASE_URL'
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY'
```

**To use it locally:**

1. Open `admin-interface.html` in a text editor
2. Replace placeholders with your actual values:

```javascript
const SUPABASE_URL = 'https://xxxxx.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGc...'  // Your actual anon key
```

3. Open the file in your browser (double-click it)
4. Sign in with your admin account
5. You can now create invitations and manage users!

## 🚀 Option 1: Keep It Local (Recommended for Now)

### Pros
- ✅ Simple - just open the HTML file
- ✅ Secure - not exposed to internet
- ✅ Fast setup - no deployment needed
- ✅ Easy to update credentials

### Cons
- ❌ Only accessible from your computer
- ❌ Can't share with other admins easily
- ❌ Needs Supabase credentials hardcoded in file

### Setup Steps

1. **Copy the file to a secure location:**
   ```bash
   cp admin-interface.html ~/Desktop/radiantcare-admin.html
   ```

2. **Edit the file:**
   ```bash
   # Use your favorite editor
   code ~/Desktop/radiantcare-admin.html  # VS Code
   # OR
   nano ~/Desktop/radiantcare-admin.html  # Terminal editor
   ```

3. **Update credentials (lines 261-262):**
   ```javascript
   const SUPABASE_URL = 'https://your-project.supabase.co'
   const SUPABASE_ANON_KEY = 'eyJhbGc...'  // Get from Supabase Dashboard
   ```

4. **Save and open in browser:**
   - Double-click the HTML file
   - OR drag it into your browser
   - Sign in with your admin account

5. **Bookmark it** for easy access!

## 🌐 Option 2: Deploy It (For Multi-Admin Teams)

If you have multiple admins who need access, you can deploy it.

### Option 2A: Deploy to Vercel (As Static Page)

1. **Create a separate directory:**
   ```bash
   mkdir -p web/public/admin
   cp admin-interface.html web/public/admin/index.html
   ```

2. **Update the file with production credentials**

3. **The file will be accessible at:**
   ```
   https://your-app.vercel.app/admin/
   ```

4. **Pros:**
   - Accessible from anywhere
   - Easy to share with other admins
   - Automatically deployed with your app

5. **Cons:**
   - Supabase credentials visible in page source (but protected by RLS)
   - Anyone can see the interface (but can't use it without admin account)

### Option 2B: Deploy as Protected Route

Better approach - integrate into main app with route protection:

**Future Enhancement:**
- Add `/admin` route to your React app
- Use AuthProvider to check if user is admin
- Redirect non-admins away
- Fully integrated with existing auth system

This is the recommended approach for production but requires more development.

## 🔐 Security Best Practices

### ✅ Good Practices

1. **Use RLS:** Already implemented - all admin actions protected by database policies
2. **Keep Admin List Small:** Only make trusted users admins
3. **Use Strong Passwords:** Admin accounts have elevated privileges
4. **Audit Admin Actions:** Check Supabase logs regularly
5. **Rotate Credentials:** If anon key is compromised, rotate it in Supabase

### ⚠️ Things to Know

1. **Anon Key is Semi-Public:** 
   - It's called "anon" key because it's meant to be in client-side code
   - Real security comes from RLS policies, not hiding the key
   - Service Role Key should NEVER be in frontend code (and it's not!)

2. **Anyone Can View HTML Source:**
   - If deployed, anyone can see your Supabase URL and anon key
   - This is **OK** because RLS protects all operations
   - Non-admins can't perform admin actions even with these credentials

3. **Physical Access = Full Access:**
   - If someone has access to your computer and the local HTML file
   - And they know your admin password
   - They can perform admin actions
   - Solution: Keep your computer secure and use strong passwords

## 🧪 Testing the Admin Interface

### Test Checklist

1. **Sign In:**
   - [ ] Can sign in with admin account
   - [ ] Can see your email displayed
   - [ ] Can see all admin panels

2. **Create Invitation:**
   - [ ] Enter email address
   - [ ] Generate invitation code
   - [ ] See it appear in "Recent Invitations" list
   - [ ] Code is properly formatted and copyable

3. **User Management:**
   - [ ] Can see list of all users
   - [ ] Can see user roles (Admin/User)
   - [ ] Can promote user to admin
   - [ ] Can demote admin to user

4. **Security Test:**
   - [ ] Sign out
   - [ ] Sign in with NON-admin account
   - [ ] Should see errors when trying to create invitations
   - [ ] Should NOT see user management options

## 📝 Usage Examples

### Creating User Invitations

1. Open admin interface (local file or deployed URL)
2. Sign in with admin account
3. Scroll to "Create User Invitation" section
4. Enter email: `newuser@example.com`
5. Optional: Set expiration days (default: 7 days, 0 = never expires)
6. Click "Create Invitation"
7. Copy the generated invitation code
8. Send it to the user (email, Slack, etc.)
9. User can now sign up at your app with this code

### Managing Users

1. Scroll to "User Management" section
2. See list of all users with:
   - Email
   - Role (Admin/User)
   - Created date
   - Action buttons
3. To promote a user:
   - Click "Promote to Admin" button
   - Confirm the action
   - User is now admin
4. To demote an admin:
   - Click "Demote to User" button
   - Confirm the action
   - User is now regular user

### Monitoring Invitations

1. Scroll to "Recent Invitations" section
2. See list of all invitations with:
   - Email
   - Invitation code
   - Created date
   - Used/Unused status
   - Expiration status
3. Filter by status if needed

## 🔄 Workflow: Onboarding New User

**Complete flow from admin perspective:**

1. **Admin creates invitation:**
   ```
   Admin Interface → Create Invitation → Enter: bob@example.com
   → Copy code: ABC123DEF456
   ```

2. **Admin sends code to user:**
   ```
   Email to bob@example.com:
   
   "You've been invited to RadiantCare Dashboard!
   
   Go to: https://your-app.vercel.app
   Click 'Sign In' → 'Create account'
   Use invitation code: ABC123DEF456
   
   Welcome aboard!"
   ```

3. **User signs up:**
   ```
   User visits app → Sign In → Create account
   → Enters email: bob@example.com
   → Enters code: ABC123DEF456
   → Sets password
   → Account created!
   ```

4. **Admin verifies:**
   ```
   Admin Interface → User Management
   → Sees bob@example.com in user list
   → Can promote to admin if needed
   ```

## 🐛 Troubleshooting

### Issue: "Sign in failed" or "Invalid credentials"

**Causes:**
- Using non-admin account
- Incorrect Supabase credentials in HTML file
- User account not confirmed

**Solutions:**
- Verify you're using admin account email/password
- Check Supabase credentials match your project
- Ensure `is_admin = true` in database for your user

### Issue: "Failed to create invitation" error

**Causes:**
- Not signed in
- Not admin user
- Network error

**Solutions:**
- Make sure you're signed in
- Check browser console (F12) for specific error
- Verify `is_admin = true` in profiles table
- Check Supabase is accessible (not down)

### Issue: Invitation code not working for user

**Causes:**
- Code expired
- Code already used
- Email doesn't match

**Solutions:**
- Check invitation status in admin interface
- Create new invitation if expired/used
- Ensure user enters EXACT email used in invitation
- Code is case-sensitive

### Issue: Can't see other users in User Management

**Causes:**
- Not admin
- RLS policy blocking access

**Solutions:**
- Verify `is_admin = true` in database
- Sign out and sign back in
- Check Supabase RLS policies are enabled

## 🎯 Quick Reference

### Admin Capabilities

| Action | Requires Admin | Protected By |
|--------|---------------|--------------|
| View admin interface | ❌ No | UI only |
| Sign in | ❌ No | Supabase Auth |
| Create invitations | ✅ Yes | RLS Policy |
| View all users | ✅ Yes | RLS Policy |
| Promote users | ✅ Yes | RLS Policy |
| Demote users | ✅ Yes | RLS Policy |
| View user scenarios | ✅ Yes | RLS Policy |

### File Locations

| File | Purpose | Location |
|------|---------|----------|
| `admin-interface.html` | Admin dashboard | Project root |
| `CREATE-ADMIN-USER.md` | Admin setup guide | Project root |
| `SUPABASE-CREDENTIALS.md` | Credentials guide | Project root |
| `supabase-setup.sql` | Database schema | Project root |

### Related Documentation

- **CREATE-ADMIN-USER.md** - How to create your first admin
- **SUPABASE-CREDENTIALS.md** - How to find Supabase credentials
- **supabase-config.md** - Supabase setup instructions
- **PHASE1-SUMMARY.md** - Database architecture details

## 🚀 Next Steps

1. **Set up your admin account** (see CREATE-ADMIN-USER.md)
2. **Configure admin-interface.html** with your Supabase credentials
3. **Open it locally** and sign in
4. **Create your first invitation** for a team member
5. **Test the signup flow** end-to-end
6. **Consider deploying** if you have multiple admins

---

**Quick Start:**
```bash
# 1. Copy admin interface to safe location
cp admin-interface.html ~/Desktop/admin.html

# 2. Edit with your credentials
# Update lines 261-262 with your Supabase URL and Anon Key

# 3. Open in browser
open ~/Desktop/admin.html

# 4. Sign in with admin account

# 5. Create invitation for first user!
```

Need help? Check CREATE-ADMIN-USER.md for admin account setup!

