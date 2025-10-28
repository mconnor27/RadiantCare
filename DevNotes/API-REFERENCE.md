# RadiantCare API Quick Reference

## Base URL
```
Production:  https://your-app.vercel.app/api
Local:       http://localhost:3000/api
```

## Authentication

All endpoints (except health, connect, callback) require authentication:

```javascript
headers: {
  'Authorization': `Bearer ${supabaseJwtToken}`,
  'Content-Type': 'application/json'
}
```

Get token from Supabase:
```javascript
const { data: { session } } = await supabase.auth.getSession()
const token = session?.access_token
```

---

## Endpoints

### Health Check
```http
GET /health
```

**Response:**
```json
{
  "ok": true,
  "timestamp": "2025-01-...",
  "service": "RadiantCare API"
}
```

---

### QuickBooks Integration

#### Connect to QuickBooks
```http
GET /qbo/connect?env=production
```

**Query Parameters:**
- `env` - `production` | `sandbox` (default: `production`)

**Response:** Redirects to QuickBooks OAuth

---

#### OAuth Callback
```http
GET /qbo/callback?code=...&realmId=...&state=...
```

**Response:** Redirects to `/` after storing tokens

---

#### Disconnect QuickBooks
```http
POST /qbo/disconnect
```

**Auth:** Admin only

**Response:**
```json
{ "ok": true }
```

---

#### Sync 2025 Data
```http
POST /qbo/sync-2025
```

**Auth:** Required (any user)

**Response:**
```json
{
  "success": true,
  "lastSyncTimestamp": "2025-01-...",
  "message": "Successfully synced all 2025 data"
}
```

**Error Responses:**
```json
// Not connected
{ "error": "not_connected", "message": "..." }

// Already synced today
{ 
  "error": "already_synced_today", 
  "message": "...",
  "lastSyncTimestamp": "..."
}
```

---

#### Get Cached 2025 Data
```http
GET /qbo/cached-2025
```

**Auth:** Required

**Response:**
```json
{
  "id": 1,
  "last_sync_timestamp": "2025-01-...",
  "daily": {...},      // Daily P&L report
  "summary": {...},    // Class summary report
  "equity": {...},     // Balance sheet
  "updated_at": "..."
}
```

---

### Scenario Management

#### List Scenarios
```http
GET /scenarios?search=...&tags=...&isPublic=true&limit=50&offset=0
```

**Auth:** Required

**Query Parameters:**
- `search` - Full-text search on name/description/tags
- `tags` - Comma-separated tags (e.g., `conservative,5-year`)
- `isPublic` - `true` to show only public scenarios
- `limit` - Number of results (default: 50)
- `offset` - Pagination offset (default: 0)

**Response:**
```json
{
  "scenarios": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "name": "Conservative Growth",
      "description": "...",
      "tags": ["conservative", "5-year"],
      "is_public": false,
      "scenario_a": {...},
      "scenario_b": {...},
      "scenario_b_enabled": false,
      "view_mode": "YTD Detailed",
      "ytd_settings": {...},
      "created_at": "...",
      "updated_at": "..."
    }
  ],
  "count": 10,
  "limit": 50,
  "offset": 0
}
```

---

#### Create Scenario
```http
POST /scenarios
Content-Type: application/json
```

**Auth:** Required

**Body:**
```json
{
  "name": "My Scenario",
  "description": "Optional description",
  "tags": ["tag1", "tag2"],
  "is_public": false,
  "scenario_a": {
    "future": [...],
    "projection": {...},
    "selectedYear": 2025,
    "dataMode": "2025 Data"
  },
  "scenario_b": null,
  "scenario_b_enabled": false,
  "view_mode": "YTD Detailed",
  "ytd_settings": {...}
}
```

**Response:** Created scenario object (201 Created)

---

#### Get Single Scenario
```http
GET /scenarios/:id
```

**Auth:** Required (owner or public)

**Response:** Scenario object

---

#### Update Scenario
```http
PUT /scenarios/:id
Content-Type: application/json
```

**Auth:** Required (owner only)

**Body:** (partial update)
```json
{
  "name": "Updated Name",
  "description": "Updated description",
  "is_public": true
}
```

**Response:** Updated scenario object

---

#### Delete Scenario
```http
DELETE /scenarios/:id
```

**Auth:** Required (owner only)

**Response:**
```json
{ "ok": true }
```

---

#### Clone Scenario
```http
POST /scenarios/:id/clone
Content-Type: application/json
```

**Auth:** Required (can clone own or public scenarios)

**Body:** (optional)
```json
{
  "name": "My Custom Clone Name"
}
```

**Response:** New scenario object (201 Created)

---

#### List Public Scenarios
```http
GET /scenarios/public?search=...&tags=...&limit=50&offset=0
```

**Auth:** Required

**Query Parameters:** Same as List Scenarios

**Response:**
```json
{
  "scenarios": [
    {
      "id": "uuid",
      "name": "...",
      "description": "...",
      "tags": [...],
      "created_at": "...",
      "updated_at": "...",
      "view_mode": "..."
    }
  ],
  "count": 5,
  "limit": 50,
  "offset": 0
}
```

Note: Only returns metadata, not full scenario data. Use `GET /scenarios/:id` to get full data.

---

## Error Responses

All endpoints return consistent error format:

```json
{
  "error": "error_code",
  "message": "Human-readable error message"
}
```

### Common Error Codes

| Code | Status | Meaning |
|------|--------|---------|
| `unauthorized` | 401 | Missing or invalid JWT token |
| `forbidden` | 403 | Insufficient permissions |
| `not_found` | 404 | Resource not found |
| `validation_error` | 400 | Invalid request data |
| `server_error` | 500 | Internal server error |
| `not_connected` | 401 | QuickBooks not connected |
| `already_synced_today` | 429 | Sync limit reached |

---

## JavaScript Examples

### Using Fetch with Supabase Auth

```javascript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Get auth token
const { data: { session } } = await supabase.auth.getSession()
const token = session?.access_token

// Make authenticated request
async function apiCall(endpoint, options = {}) {
  const response = await fetch(`/api${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message)
  }
  
  return response.json()
}

// Examples
const scenarios = await apiCall('/scenarios')
const scenario = await apiCall('/scenarios/123')
const created = await apiCall('/scenarios', {
  method: 'POST',
  body: JSON.stringify({ name: 'Test', scenario_a: {...} })
})
```

### Using Axios with Supabase Auth

```javascript
import axios from 'axios'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Create axios instance with interceptor
const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add auth token to every request
api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`
  }
  return config
})

// Examples
const { data: scenarios } = await api.get('/scenarios')
const { data: scenario } = await api.get(`/scenarios/${id}`)
const { data: created } = await api.post('/scenarios', scenarioData)
```

---

## Testing with cURL

### Get Scenarios
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/scenarios
```

### Create Scenario
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","scenario_a":{...}}' \
  http://localhost:3000/api/scenarios
```

### Sync QuickBooks
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/qbo/sync-2025
```

---

## Rate Limits

Vercel serverless functions:
- **Hobby Plan:** 100,000 executions/month
- **Pro Plan:** 1,000,000 executions/month
- **No per-IP rate limits** (implement custom if needed)

QuickBooks API:
- **500 requests per minute** per app
- **10,000 requests per day** per app

---

## Best Practices

### 1. Error Handling
```javascript
try {
  const data = await apiCall('/scenarios')
} catch (error) {
  if (error.message.includes('unauthorized')) {
    // Redirect to login
  } else {
    // Show error to user
    alert(error.message)
  }
}
```

### 2. Loading States
```javascript
const [loading, setLoading] = useState(false)

async function loadScenarios() {
  setLoading(true)
  try {
    const data = await apiCall('/scenarios')
    setScenarios(data.scenarios)
  } finally {
    setLoading(false)
  }
}
```

### 3. Pagination
```javascript
const [page, setPage] = useState(0)
const limit = 20

const { scenarios, count } = await apiCall(
  `/scenarios?limit=${limit}&offset=${page * limit}`
)

const totalPages = Math.ceil(count / limit)
```

### 4. Search & Filter
```javascript
const [search, setSearch] = useState('')
const [tags, setTags] = useState(['conservative'])

const params = new URLSearchParams()
if (search) params.set('search', search)
if (tags.length) params.set('tags', tags.join(','))

const { scenarios } = await apiCall(`/scenarios?${params}`)
```

---

## Need Help?

- 📖 See `DEPLOYMENT.md` for deployment guide
- 📝 See `PHASE2-SUMMARY.md` for architecture overview
- 🔧 Check Vercel function logs for debugging
- 🐛 Check Supabase logs for database issues
