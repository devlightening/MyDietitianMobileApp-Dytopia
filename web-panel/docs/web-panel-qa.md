# Web Panel QA Guide

**Version:** 1.0.0  
**Last Updated:** 2026-02-14

## Table of Contents
1. [Manual Smoke Test Checklist](#manual-smoke-test-checklist)
2. [Running Playwright E2E Tests](#running-playwright-e2e-tests)
3. [Required Environment Variables](#required-environment-variables)
4. [Test Data Setup](#test-data-setup)
5. [Troubleshooting](#troubleshooting)

---

## Manual Smoke Test Checklist

### Prerequisites
- [ ] Backend API is running
- [ ] Database is seeded with test data
- [ ] Test dietitian account exists
- [ ] Test client account exists

### Test Flow

#### 1. Unauthenticated Access Protection
- [ ] Open browser in incognito/private mode
- [ ] Navigate to `http://localhost:3001/dashboard`
- [ ] **Expected:** Redirected to `/auth/login`
- [ ] **Expected:** URL contains `?redirect=/dashboard`
- [ ] **Expected:** Login form is visible

#### 2. Login Flow
- [ ] Enter test dietitian email
- [ ] Enter test dietitian password
- [ ] Click "Giriş Yap" button
- [ ] **Expected:** Redirected to `/dashboard`
- [ ] **Expected:** Dashboard loads without errors
- [ ] **Expected:** KPI cards are visible
- [ ] **Expected:** Activity feed is visible (or empty state)
- [ ] **Verify API:** Open browser DevTools Network tab
- [ ] **Expected:** Request to `/api/auth/me` returns 200 OK
- [ ] **Expected:** Response contains `role: "dietitian"`

#### 3. Dashboard Navigation
- [ ] Verify sidebar is visible
- [ ] Verify all menu items are present:
  - Dashboard
  - Clients
  - Recipes
  - Plans
  - Recipe Match
  - Access Keys
  - Branding
- [ ] Click each menu item
- [ ] **Expected:** Each page loads without crashing

#### 4. Clients List Page
- [ ] Click "Clients" in sidebar
- [ ] **Expected:** URL is `/dashboard/clients`
- [ ] **Expected:** Page loads without errors
- [ ] **Expected:** Either client list or empty state is shown
- [ ] **Expected:** No console errors

#### 5. Client Detail Page
- [ ] Click on a client from the list (or navigate to `/dashboard/clients/[test-client-id]`)
- [ ] **Expected:** Client detail page loads
- [ ] **Expected:** Client header with name is visible
- [ ] **Expected:** Tabs are visible (Overview, Activities, Measurements, Plan, Notes)
- [ ] Click each tab
- [ ] **Expected:** Each tab content loads without errors

#### 6. Client Detail - Overview Tab
- [ ] Verify compliance donut chart is visible
- [ ] Verify quick stats are visible (Weight, BMI, Height, BMR)
- [ ] **Expected:** No console errors

#### 7. Client Detail - Activities Tab
- [ ] Click "Activities" tab
- [ ] **Expected:** Activity timeline loads (or empty state)
- [ ] **Expected:** Activities have icons and timestamps

#### 8. Client Detail - Measurements Tab
- [ ] Click "Measurements" tab
- [ ] **Expected:** Weight chart loads (or empty state)
- [ ] **Expected:** Data table is visible if measurements exist

#### 9. Client Detail - Notes Tab
- [ ] Click "Notes" tab
- [ ] Type a test note in the input field
- [ ] Click "Add Note" button
- [ ] **Expected:** Note is added to the list
- [ ] **Expected:** Input field is cleared
- [ ] **Expected:** Success toast appears (if implemented)

#### 10. Access Key Modal
- [ ] Navigate to `/dashboard/access-keys`
- [ ] Click "Generate" or "Create" button (if available)
- [ ] **Expected:** Modal opens
- [ ] Enter test client ID (format: MD-XXXX-XXXX-XX)
- [ ] Select start and end dates
- [ ] Click "Generate Access Key"
- [ ] **Expected:** Access key is generated and displayed
- [ ] Click copy button
- [ ] **Expected:** Key is copied to clipboard
- [ ] **Expected:** Success toast appears
- [ ] Click "Done" or close modal
- [ ] **Expected:** Modal closes

#### 11. Logout Flow
- [ ] Click logout button in sidebar
- [ ] **Expected:** Redirected to `/auth/login`
- [ ] **Expected:** No errors in console
- [ ] Try to access `/dashboard` directly
- [ ] **Expected:** Redirected back to `/auth/login`

#### 12. Non-Dietitian Access (if applicable)
- [ ] Login with a client account (non-dietitian)
- [ ] Try to access `/dashboard`
- [ ] **Expected:** 403 "Access Denied" page is shown
- [ ] **Expected:** No app crash
- [ ] **Expected:** "Go to Login" button is visible

---

## Running Playwright E2E Tests

### Installation

If Playwright is not installed, run:
```bash
npm install --save-dev @playwright/test
npx playwright install
```

### Running Tests

#### Run all tests (headless)
```bash
npm run test:e2e
```

#### Run tests with UI mode (recommended for debugging)
```bash
npm run test:e2e:ui
```

#### Run tests in headed mode (see browser)
```bash
npm run test:e2e:headed
```

#### Run specific test file
```bash
npx playwright test tests/e2e/smoke.spec.ts
```

#### Run specific test by name
```bash
npx playwright test -g "Login works"
```

### Test Reports

After running tests, view the HTML report:
```bash
npx playwright show-report
```

---

## Required Environment Variables

### For Development
Create a `.env.local` file in the web-panel directory:

```env
# API Base URL (optional, defaults to relative URLs)
NEXT_PUBLIC_API_URL=http://localhost:5000

# Other environment variables as needed
```

### For E2E Tests
Create a `.env.test` file in the web-panel directory:

```env
# Base URL for the application
BASE_URL=http://localhost:3001

# Test dietitian credentials
TEST_DIETITIAN_EMAIL=test@dietitian.com
TEST_DIETITIAN_PASSWORD=TestPassword123!

# Test client ID for client detail page tests
TEST_CLIENT_ID=test-client-id
```

### Environment Variable Descriptions

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `BASE_URL` | No | `http://localhost:3001` | Base URL for E2E tests |
| `TEST_DIETITIAN_EMAIL` | No | `test@dietitian.com` | Email for test dietitian account |
| `TEST_DIETITIAN_PASSWORD` | No | `TestPassword123!` | Password for test dietitian account |
| `TEST_CLIENT_ID` | No | `test-client-id` | Client ID for testing client detail page |

---

## Test Data Setup

### Backend Requirements

For E2E tests to pass, the backend must have:

1. **Test Dietitian Account**
   - Email: As specified in `TEST_DIETITIAN_EMAIL`
   - Password: As specified in `TEST_DIETITIAN_PASSWORD`
   - Role: `dietitian`

2. **Test Client Account** (optional, for client detail tests)
   - ID: As specified in `TEST_CLIENT_ID`
   - Linked to test dietitian

3. **API Endpoints**
   - `POST /api/auth/dietitian/login` - Login endpoint
   - `POST /api/auth/logout` - Logout endpoint
   - `GET /api/auth/me` - Get current user info (role verification)
   - `GET /api/dietitian/dashboard/stats` - Dashboard KPIs
   - `GET /api/dietitian/clients` - Clients list
   - `GET /api/dietitian/clients/:id` - Client detail

### Database Seeding

If using a seeding script, ensure it creates:
```sql
-- Test dietitian
INSERT INTO Dietitians (Email, PasswordHash, FullName, ClinicName)
VALUES ('test@dietitian.com', '<hashed_password>', 'Test Dietitian', 'Test Clinic');

-- Test client (optional)
INSERT INTO Clients (PublicUserId, FullName, Email)
VALUES ('test-client-id', 'Test Client', 'testclient@example.com');
```

---

## Troubleshooting

### Tests Fail with "Navigation timeout"

**Cause:** Backend is not running or slow to respond

**Solution:**
1. Verify backend is running on the expected port
2. Check backend logs for errors
3. Increase timeout in `playwright.config.ts`:
   ```typescript
   use: {
     navigationTimeout: 30000, // 30 seconds
   }
   ```

### Tests Fail with "Element not found"

**Cause:** UI has changed or element selectors are outdated

**Solution:**
1. Run tests in UI mode: `npm run test:e2e:ui`
2. Use the picker to find correct selectors
3. Update test selectors accordingly

### Login Test Fails

**Cause:** Test credentials don't exist or are incorrect

**Solution:**
1. Verify test dietitian account exists in database
2. Check `.env.test` file has correct credentials
3. Try logging in manually with the same credentials

### "access_token cookie not set" Error

**Cause:** Backend login endpoint not setting cookie correctly

**Solution:**
1. Check backend login endpoint sets `HttpOnly` cookie
2. Verify `withCredentials: true` in API client
3. Check CORS settings allow credentials

### Tests Pass Locally but Fail in CI

**Cause:** Environment differences or missing dependencies

**Solution:**
1. Ensure CI has Playwright browsers installed:
   ```bash
   npx playwright install --with-deps
   ```
2. Set `CI=true` environment variable
3. Use headless mode in CI
4. Check CI has access to backend

### Modal Tests Fail

**Cause:** Modal not implemented or different structure

**Solution:**
1. Check if access keys page has a "Generate" button
2. Verify modal uses `role="dialog"` attribute
3. Update test selectors to match actual implementation
4. Consider skipping test if feature not implemented:
   ```typescript
   test.skip(condition, 'Reason for skipping');
   ```

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Install Playwright
        run: npx playwright install --with-deps
      
      - name: Run E2E tests
        run: npm run test:e2e
        env:
          BASE_URL: http://localhost:3001
          TEST_DIETITIAN_EMAIL: ${{ secrets.TEST_DIETITIAN_EMAIL }}
          TEST_DIETITIAN_PASSWORD: ${{ secrets.TEST_DIETITIAN_PASSWORD }}
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
```

---

## Best Practices

### Writing New Tests
1. **Use Page Object Model:** Create reusable page objects for common interactions
2. **Independent Tests:** Each test should be able to run independently
3. **Clean State:** Reset state between tests (logout, clear cookies)
4. **Descriptive Names:** Use clear, descriptive test names
5. **Wait Strategies:** Use `waitForSelector` instead of fixed delays

### Debugging Tests
1. **Use UI Mode:** `npm run test:e2e:ui` for interactive debugging
2. **Screenshots:** Tests automatically capture screenshots on failure
3. **Traces:** Enable trace recording for failed tests
4. **Console Logs:** Check browser console for errors

### Maintaining Tests
1. **Update Selectors:** Keep selectors up to date with UI changes
2. **Review Failures:** Don't ignore flaky tests, fix them
3. **Version Control:** Commit test updates with related UI changes
4. **Documentation:** Update this guide when adding new tests

---

## Contact

For questions or issues with QA:
- **Frontend Team:** [frontend@mydietitian.com]
- **QA Lead:** [qa@mydietitian.com]
- **Documentation:** See `docs/web-panel-audit.md` for detailed audit report
