# End-to-End Regression Verification Checklist

## Prerequisites
- Backend: .NET SDK installed, PostgreSQL running
- Frontend: Node.js and npm installed
- Browser: Chrome/Edge DevTools enabled

---

## Step 1: Hard Restart Both Apps

### Backend
```bash
cd src/MyDietitianMobileApp.Api
dotnet clean
dotnet build
dotnet run
```

**Expected:**
- Build succeeds with no errors
- Backend starts on `http://localhost:5000` and `https://localhost:7154`
- Database connections successful
- Swagger UI available at `http://localhost:5000/swagger` (if enabled)

### Frontend
```bash
cd web-panel
npm run dev
```

**Expected:**
- Next.js starts on `http://localhost:3000`
- No build errors
- Next.js rewrites configured (check console for rewrite info)

---

## Step 2: Clear Browser Site Data

### Chrome/Edge DevTools
1. Open DevTools (F12)
2. Go to **Application** tab
3. **Storage** → **Clear site data**
   - Check: Cookies, Local storage, Session storage
   - Click **Clear site data**
4. **Cookies** → `http://localhost:3000`
   - Manually delete `access_token` if present
5. **Cookies** → `http://localhost:5000`
   - Manually delete `access_token` if present

**Expected:**
- All cookies cleared
- No `access_token` cookie visible

---

## Step 3: Login Verification

1. Navigate to `http://localhost:3000/auth/login`
2. Enter valid Dietitian credentials
3. Submit login form

### Check DevTools → Application → Cookies
- **Location:** `http://localhost:3000`
- **Cookie Name:** `access_token`
- **Value:** (JWT token string)
- **HttpOnly:** ✅ Checked
- **Secure:** ❌ Unchecked (development)
- **SameSite:** `Lax` (development)
- **Path:** `/`

### Check Network Tab
- Request: `POST /api/auth/dietitian/login`
- **Request URL:** `http://localhost:3000/api/auth/dietitian/login` (rewritten)
- **Status:** `200 OK`
- **Response:** `{ "ok": true }`
- **Set-Cookie header present:** `access_token=...; HttpOnly; SameSite=Lax; Path=/`

**Expected:**
- ✅ Cookie created successfully
- ✅ Login redirects to `/dashboard`
- ✅ No console errors

---

## Step 4: Verify Same-Origin API Calls

1. Navigate to `http://localhost:3000/dashboard/access-keys`
2. Open DevTools → **Network** tab
3. Filter: `XHR` or `Fetch`
4. Wait for page to load (GET access-keys request)

### Check Network Requests
- **Request URL:** `http://localhost:3000/api/dietitian/access-keys` (NOT `localhost:5000`)
- **Request Headers:**
  - `Cookie: access_token=...` ✅ Present
- **Status:** `200 OK`
- **Response:** JSON with `accessKeys` array

**Expected:**
- ✅ All API calls go through `localhost:3000/api/...` (same-origin)
- ✅ Cookies included automatically
- ✅ No CORS errors
- ✅ No cookie policy warnings

---

## Step 5: GET Access Keys Verification

### Network Tab Check
- Request: `GET /api/dietitian/access-keys`
- **Status:** `200 OK` (NOT 401)
- **Response Body:** 
  ```json
  {
    "accessKeys": [...]
  }
  ```

### Backend Logs Check
- Open backend console/terminal
- Look for log entry: `POST access-keys: User claims: ...`
- **Should contain:** `sub=...` or `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier=...`
- **Should NOT contain:** "sub claim not found" warning

**Expected:**
- ✅ Returns 200 (not 401)
- ✅ Backend logs show user claims with userId
- ✅ No "sub claim not found" errors

---

## Step 6: POST Create Access Key

1. On `/dashboard/access-keys` page
2. Fill form:
   - **Client Public ID:** `MD-TEST-TEST-TE` (or valid format)
   - **Start Date:** Today or future date
   - **End Date:** After start date
   - **Scope:** Any valid scope
3. Click **Create** or **Submit**

### Network Tab Check
- Request: `POST /api/dietitian/access-keys`
- **Status:** `200 OK` (NOT 401)
- **Request Body:**
  ```json
  {
    "clientId": "MD-TEST-TEST-TE",
    "startDate": "2024-01-15",
    "endDate": "2024-02-15",
    "scope": "..."
  }
  ```
- **Response Body:**
  ```json
  {
    "success": true,
    "key": "XXXXXXXXXXXX",
    "clientId": "MD-TEST-TEST-TE",
    "startDate": "2024-01-15",
    "endDate": "2024-02-15"
  }
  ```

### Backend Logs Check
- Look for: `POST access-keys: User claims: sub=..., role=Dietitian, ...`
- **Should NOT see:** "sub claim not found" or "User ID claim not found"
- **Should see:** Access key created successfully

### UI Check
- ✅ Success message displayed
- ✅ New access key appears in list
- ✅ Form resets

**Expected:**
- ✅ POST returns 200
- ✅ Access key created successfully
- ✅ UI shows success
- ✅ Backend logs show `sub` claim (not missing)

---

## Step 7: Logout Verification

1. Click **Logout** button (in sidebar or topbar)
2. Open DevTools → **Network** tab

### Network Tab Check
- Request: `POST /api/auth/logout`
- **Status:** `200 OK`
- **Response:** `{ "ok": true }`
- **Set-Cookie header:** `access_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; ...`

### Application Tab → Cookies Check
- Navigate to `http://localhost:3000`
- **Cookie:** `access_token`
- **Status:** ❌ Should be **deleted** or **expired** (not visible)

### Navigation Check
1. After logout, should redirect to `/auth/login`
2. Try navigating to `http://localhost:3000/dashboard`
3. **Expected:** Redirects back to `/auth/login`

**Expected:**
- ✅ Logout request returns 200
- ✅ Cookie deleted/expired
- ✅ Redirects to login
- ✅ Cannot access `/dashboard` without login

---

## Step 8: UI Verification (Horizontal Scrollbar)

1. Navigate to `http://localhost:3000/dashboard`
2. Check for horizontal scrollbar at bottom of page
3. Navigate to `http://localhost:3000/dashboard/access-keys`
4. Check for horizontal scrollbar

### Visual Check
- **Horizontal scrollbar:** ❌ Should NOT be present
- **Sidebar:** ✅ Works correctly (hover, lock/unlock)
- **Content:** ✅ Scrolls vertically only
- **Layout:** ✅ No overflow issues

### DevTools Check
1. Open DevTools → **Elements** tab
2. Inspect `<html>` element
   - **Computed styles:** `overflow-x: hidden` ✅
3. Inspect `<body>` element
   - **Computed styles:** `overflow-x: hidden` ✅
4. Inspect main content container
   - **Computed styles:** `overflow-x: hidden` ✅
   - **Computed styles:** `min-width: 0px` ✅

**Expected:**
- ✅ No horizontal scrollbar
- ✅ Sidebar functionality intact
- ✅ Layout responsive

---

## Summary Checklist

- [ ] Backend builds and runs successfully
- [ ] Frontend builds and runs successfully
- [ ] Browser cookies cleared
- [ ] Login creates `access_token` cookie (HttpOnly)
- [ ] API calls go through `localhost:3000/api/...` (same-origin)
- [ ] GET `/api/dietitian/access-keys` returns 200 (not 401)
- [ ] POST `/api/dietitian/access-keys` returns 200 (not 401)
- [ ] Backend logs show `sub` claim (not "sub claim not found")
- [ ] Logout deletes cookie successfully
- [ ] `/dashboard` redirects to login after logout
- [ ] No horizontal scrollbar on dashboard pages
- [ ] Sidebar functionality works correctly

---

## Troubleshooting

### If GET/POST returns 401:
1. Check backend logs for claim information
2. Verify `MapInboundClaims = false` in `Program.cs`
3. Verify JWT token includes both `sub` and `nameidentifier` claims
4. Clear cookies and re-login

### If API calls go to `localhost:5000`:
1. Check `next.config.js` rewrites configuration
2. Verify `baseURL: ''` in `web-panel/lib/api.ts`
3. Restart Next.js dev server

### If cookie not deleted on logout:
1. Check cookie options match between login and logout
2. Verify both `Delete` and overwrite with expired cookie
3. Check browser DevTools → Application → Cookies

### If horizontal scrollbar appears:
1. Check `overflow-x-hidden` on html, body, and main containers
2. Verify `min-w-0` on flex containers
3. Check for elements with fixed widths exceeding viewport
