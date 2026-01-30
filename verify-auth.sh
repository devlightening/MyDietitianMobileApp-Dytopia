#!/bin/bash
# Bash Script for Quick Verification
# Run this after starting both backend and frontend

echo "=== MyDietitian Auth Verification Script ==="
echo ""

# Check if backend is running
echo "1. Checking backend (http://localhost:5000)..."
if curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/swagger | grep -q "200"; then
    echo "   ✓ Backend is running"
else
    echo "   ✗ Backend not responding. Make sure it's running on port 5000"
fi

# Check if frontend is running
echo "2. Checking frontend (http://localhost:3000)..."
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 | grep -q "200"; then
    echo "   ✓ Frontend is running"
else
    echo "   ✗ Frontend not responding. Make sure it's running on port 3000"
fi

echo ""
echo "=== Manual Verification Steps ==="
echo ""
echo "1. Open browser: http://localhost:3000/auth/login"
echo "2. Login as Dietitian"
echo "3. Open DevTools (F12) → Application → Cookies"
echo "4. Verify 'access_token' cookie exists (HttpOnly, SameSite=Lax)"
echo "5. Navigate to /dashboard/access-keys"
echo "6. Open DevTools → Network tab"
echo "7. Verify API calls go to 'localhost:3000/api/...' (same-origin)"
echo "8. Verify GET /api/dietitian/access-keys returns 200"
echo "9. Create an access key and verify POST returns 200"
echo "10. Check backend logs - should show 'sub' claim, NOT 'sub claim not found'"
echo "11. Click logout and verify cookie is deleted"
echo "12. Verify no horizontal scrollbar on dashboard pages"
echo ""
echo "See VERIFICATION_CHECKLIST.md for detailed steps"
