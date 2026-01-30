# PowerShell Script for Quick Verification
# Run this after starting both backend and frontend

Write-Host "=== MyDietitian Auth Verification Script ===" -ForegroundColor Cyan
Write-Host ""

# Check if backend is running
Write-Host "1. Checking backend (http://localhost:5000)..." -ForegroundColor Yellow
try {
    $backendResponse = Invoke-WebRequest -Uri "http://localhost:5000/swagger" -Method GET -TimeoutSec 2 -ErrorAction SilentlyContinue
    if ($backendResponse.StatusCode -eq 200) {
        Write-Host "   ✓ Backend is running" -ForegroundColor Green
    }
} catch {
    Write-Host "   ✗ Backend not responding. Make sure it's running on port 5000" -ForegroundColor Red
}

# Check if frontend is running
Write-Host "2. Checking frontend (http://localhost:3000)..." -ForegroundColor Yellow
try {
    $frontendResponse = Invoke-WebRequest -Uri "http://localhost:3000" -Method GET -TimeoutSec 2 -ErrorAction SilentlyContinue
    if ($frontendResponse.StatusCode -eq 200) {
        Write-Host "   ✓ Frontend is running" -ForegroundColor Green
    }
} catch {
    Write-Host "   ✗ Frontend not responding. Make sure it's running on port 3000" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== Manual Verification Steps ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Open browser: http://localhost:3000/auth/login" -ForegroundColor White
Write-Host "2. Login as Dietitian" -ForegroundColor White
Write-Host "3. Open DevTools (F12) → Application → Cookies" -ForegroundColor White
Write-Host "4. Verify 'access_token' cookie exists (HttpOnly, SameSite=Lax)" -ForegroundColor White
Write-Host "5. Navigate to /dashboard/access-keys" -ForegroundColor White
Write-Host "6. Open DevTools → Network tab" -ForegroundColor White
Write-Host "7. Verify API calls go to 'localhost:3000/api/...' (same-origin)" -ForegroundColor White
Write-Host "8. Verify GET /api/dietitian/access-keys returns 200" -ForegroundColor White
Write-Host "9. Create an access key and verify POST returns 200" -ForegroundColor White
Write-Host "10. Check backend logs - should show 'sub' claim, NOT 'sub claim not found'" -ForegroundColor White
Write-Host "11. Click logout and verify cookie is deleted" -ForegroundColor White
Write-Host "12. Verify no horizontal scrollbar on dashboard pages" -ForegroundColor White
Write-Host ""
Write-Host "See VERIFICATION_CHECKLIST.md for detailed steps" -ForegroundColor Cyan
