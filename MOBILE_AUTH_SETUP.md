# Mobile App Authentication Setup Guide

## Overview
This guide covers the mobile app authentication setup, including LAN connectivity, iOS configuration, and troubleshooting.

## Task Completion Summary

### ✅ Task 1: Single Source of Truth for API Base URL
- **File:** `mobile-app/src/config/api.ts`
- Uses `EXPO_PUBLIC_API_BASE_URL` environment variable
- Falls back to `http://localhost:5000` in development
- Logs API base URL on app startup

### ✅ Task 2: Health Endpoint
- **File:** `src/MyDietitianMobileApp.Api/Controllers/HealthController.cs`
- Endpoint: `GET /api/health`
- Returns: `{ ok: true, timeUtc: "..." }`
- No authentication required

### ✅ Task 3: Connectivity Test Button
- **File:** `mobile-app/src/screens/LoginScreen.tsx`
- Dev-only button on login screen
- Tests `GET /api/health` with 5s timeout
- Displays: baseURL, request duration, success/failure, error details

### ✅ Task 4: Backend LAN Binding
- **File:** `src/MyDietitianMobileApp.Api/Program.cs`
- Already configured: `http://0.0.0.0:5000`
- No HTTPS redirect in Development (no `UseHttpsRedirection()` call)

### ✅ Task 5: iOS ATS Configuration
- **File:** `mobile-app/app.json`
- Added `NSAppTransportSecurity.NSAllowsArbitraryLoads = true`
- **Note:** This is for development only. Production should use HTTPS.

### ✅ Task 6: Header-Based Auth for Mobile
- **File:** `src/MyDietitianMobileApp.Api/Controllers/ClientAuthenticationController.cs`
- Login response now includes:
  - `token` (JWT)
  - `expiresAtUtc` (ISO 8601 format)
  - `role` ("Client")
  - `userId` (from token claims)
  - `publicUserId`
  - `isPremium`
- Cookie still set for web panel compatibility
- Mobile app uses `Authorization: Bearer <token>` header

### ✅ Task 7: Increased Timeout & Better Error Messages
- **File:** `mobile-app/src/api/client.ts`
- Timeout increased from 10s to 25s
- **File:** `mobile-app/src/screens/LoginScreen.tsx`
- Improved error messages for timeout/network errors
- Shows specific troubleshooting steps

## Setup Instructions

### 1. Configure API Base URL

**Step 1:** Copy the example environment file:

```bash
cd mobile-app
cp .env.example .env
```

**Step 2:** Edit `.env` and set your LAN IP:

Open `mobile-app/.env` and replace `YOUR_LAN_IP` with your actual LAN IP address:

```bash
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.40:5000
```

**Note:** The `.env` file is gitignored and will not be committed. Each developer should create their own `.env` file.

**Step 2:** Find your PC's LAN IP address:

- **Windows:** Run `ipconfig` in Command Prompt → Look for "IPv4 Address"
- **Mac/Linux:** Run `ifconfig` or `ip addr` → Look for "inet" address

**Step 3:** Edit `.env` and set your LAN IP:

```bash
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.100:5000
```

**⚠️ IMPORTANT:** 
- On physical devices, `localhost` points to the phone itself, NOT your PC
- You MUST use your PC's LAN IP address (e.g., `192.168.1.100`)
- `localhost` is ONLY allowed on iOS Simulator or Android Emulator

**Step 3:** Restart Expo with cache clear:

```bash
cd mobile-app
npx expo start --clear
```

**Why `--clear`?** This clears the Metro bundler cache and ensures environment variables are reloaded. This is critical after creating or modifying `.env` file.

**Step 4:** Verify the configuration:

After the app starts, check the console logs. You should see:

```
=== API Configuration ===
Resolved API_BASE_URL: http://192.168.1.40:5000
Source: process.env.EXPO_PUBLIC_API_BASE_URL
EXPO_PUBLIC_API_BASE_URL: http://192.168.1.40:5000
expoConfig.extra.apiBaseUrl: http://192.168.1.40:5000
Is Physical Device: true
Platform: ios
Execution Environment: bare
========================
```

**⚠️ CRITICAL:** If you see `localhost` in the resolved URL on a physical device, the app will throw an error. This is intentional to prevent silent failures.

### 2. Start Backend

```bash
cd src/MyDietitianMobileApp.Api
dotnet run
```

**Verify backend is accessible:**
- Backend should start on `http://0.0.0.0:5000` (accessible from LAN)
- Ensure both your phone and PC are on the same Wi-Fi network
- Test from phone browser: `http://YOUR_PC_IP:5000/api/health` should return `{ ok: true, ... }`

### 3. Test Connectivity

1. Open mobile app (after setting `.env` and restarting)
2. Navigate to Login screen
3. Tap "🔍 Bağlantı Testi" button (dev only)
4. Should show success with:
   - Base URL
   - Request duration
   - HTTP status
   - Response data

**If you see "Yapılandırma Hatası" modal:**
- This means `localhost` was detected on a physical device
- Follow the steps in the modal to fix
- Ensure `.env` file exists and `EXPO_PUBLIC_API_BASE_URL` is set to LAN IP

### 4. Test Login

1. Enter credentials
2. Tap "Giriş Yap"
3. Check console logs for:
   - `API_BASE_URL: ...` (should be your LAN IP, NOT localhost)
   - `Login URL: ...`
   - Login success/error details

**Expected console output:**
```
=== API Configuration ===
API_BASE_URL: http://192.168.1.100:5000
EXPO_PUBLIC_API_BASE_URL: http://192.168.1.100:5000
expoConfig.extra.apiBaseUrl: http://192.168.1.100:5000
Is Physical Device: true
Platform: ios
========================
```

## Troubleshooting

### Issue: "Cannot reach server"

**Check:**
1. Backend is running on `0.0.0.0:5000` (not `localhost`)
2. Firewall allows port 5000
3. Mobile device and backend are on same network
4. `EXPO_PUBLIC_API_BASE_URL` is set correctly
5. LAN IP address is correct

**Solution:**
- Use Connectivity Test button to diagnose
- Check backend logs for incoming requests
- Verify firewall settings (Windows Firewall, macOS Firewall)

### Issue: iOS Network Error

**Check:**
1. `app.json` has `NSAllowsArbitraryLoads: true`
2. Backend is using HTTP (not HTTPS) in development
3. No HTTPS redirect in Development mode

**Solution:**
- Rebuild app after changing `app.json`
- Ensure backend `Program.cs` doesn't call `UseHttpsRedirection()` in Development

### Issue: Timeout Errors

**Check:**
1. Network latency (use Connectivity Test)
2. Backend is responsive (test with curl/Postman)
3. Timeout is set to 25s (should be sufficient)

**Solution:**
- Increase timeout in `mobile-app/src/api/client.ts` if needed
- Check backend performance
- Verify network stability

## Production Considerations

### iOS ATS
**Important:** `NSAllowsArbitraryLoads: true` should be removed in production. Instead:
- Use HTTPS endpoints
- Configure proper ATS exceptions if needed
- Use certificate pinning for security

### API Base URL
- Production should use HTTPS
- Set `EXPO_PUBLIC_API_BASE_URL=https://api.mydietitian.com`
- Remove fallback to localhost

### Security
- JWT tokens stored in SecureStore (already implemented)
- Header-based auth for mobile (already implemented)
- Cookie-based auth for web (already implemented)

## Verification Checklist

- [ ] Backend starts on `0.0.0.0:5000`
- [ ] `/api/health` endpoint returns `{ ok: true, timeUtc: "..." }`
- [ ] Connectivity Test button works (dev only)
- [ ] Login shows API_BASE_URL and Login URL in console
- [ ] Login response includes `token`, `expiresAtUtc`, `userId`
- [ ] Mobile app uses `Authorization: Bearer <token>` header
- [ ] Timeout is 25s
- [ ] Error messages show troubleshooting steps
- [ ] iOS ATS allows HTTP in development
- [ ] No HTTPS redirect in Development mode
