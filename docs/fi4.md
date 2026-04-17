We now have a clear environment-specific bug.

Observed behavior:
- Local web panel works:
  http://localhost:3000/dashboard
- Production web panel route renders, but dashboard API calls fail:
  https://www.dytopia.xyz/dashboard
- The main confirmed failing request in production is:
  GET /api/dietitian/dashboard/stats -> 503 Service Unavailable
- Browser console shows this exact production failure repeatedly.
- Local and production behavior are different, which strongly suggests a production-only proxy/env/base-URL resolution issue.
- The issue is NOT the dashboard UI itself.
- The dashboard page shell loads, but the server-side/API proxy path used in production is failing.

Important context:
1. Local works.
2. Production fails.
3. Requests are being made from the deployed web panel.
4. At least one confirmed failing endpoint is:
   /api/dietitian/dashboard/stats
5. We also had earlier backend logs showing EF Core concurrency problems in nearby flows:
   "A second operation was started on this context instance before a previous operation completed."
   around DietitianManagementController.GetClientById
   So there may be TWO issues:
   - production proxy/env resolution issue
   - separate backend concurrency issue on some endpoints

Your task:
1. Compare LOCAL vs PRODUCTION request flow for dashboard endpoints.
2. Audit how web-panel resolves backend base URL in:
   - lib/server-api.ts
   - app/api/[...path]/route.ts
   - any proxy helpers
   - any env lookup order such as:
     INTERNAL_API_BASE_URL
     NEXT_PUBLIC_API_BASE_URL
     localhost fallback
3. Find exactly why production still returns 503 for /api/dietitian/dashboard/stats while local works.
4. Verify whether production is accidentally falling back to localhost / 127.0.0.1 / an unavailable internal URL.
5. Fix the proxy/base-URL/env resolution so production and local both use the correct backend target.
6. Also audit dashboard endpoints for backend-side resilience:
   - /api/dietitian/dashboard/stats
   - /api/dietitian/dashboard/activity
   - summary endpoints
   - care-hub / appointments / settings bootstrap calls
7. Re-check any EF Core concurrency hazards and remove them where still present.
8. Reduce duplicate dashboard error toasts:
   - dedupe same message
   - do not spam multiple identical toasts
   - let widgets fail independently

Do NOT:
- do not make blind changes
- do not add fake data
- do not hide root cause behind generic catch blocks
- do not assume tunnel is the issue unless logs prove transport failure

Expected output:
1. Apply code changes directly.
2. Give me a concise Turkish summary including:
   - exact reason local works but production fails
   - which env/proxy file was wrong
   - which production URL/base URL was actually being used before fix
   - which files changed
   - whether dashboard stats/activity now work in production
   - whether any remaining EF Core concurrency risks were found
3. If Vercel environment variables must be changed, tell me EXACTLY which variables and exact values to set.

Acceptance criteria:
- localhost dashboard still works
- production dashboard works too
- /api/dietitian/dashboard/stats no longer returns 503 in production
- duplicate toast spam is reduced
- local/prod behavior is aligned


Source of truth:
- Production browser console confirms:
  GET https://www.dytopia.xyz/api/dietitian/dashboard/stats 503 (Service Unavailable)
- Local dashboard works at http://localhost:3000/dashboard
This is the key clue: production-only proxy/env mismatch.