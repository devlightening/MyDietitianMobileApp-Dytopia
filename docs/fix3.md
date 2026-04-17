Fix the unstable dashboard data loading in MyDietitianMobileApp web-panel.

Current symptoms:
- The dashboard page renders, but dashboard data intermittently disappears and the page shows repeated toast errors:
  "Sunucuda bir hata oluştu. Lütfen daha sonra tekrar deneyin."
  "Panel verileri alınamadı"
- DevTools shows:
  GET /api/dietitian/dashboard/stats -> 503 Service Unavailable
  response body:
  {
    "error": "Backend service unavailable",
    "message": "Failed to fetch dashboard stats"
  }

Important confirmed evidence:
1. The issue is NOT domain/DNS anymore.
2. Requests DO reach the backend.
3. Dashboard-specific requests fail.
4. Existing backend logs already show EF Core concurrency failures:
   "A second operation was started on this context instance before a previous operation completed."
5. One confirmed crash location from logs:
   MyDietitianMobileApp.Api.Controllers.DietitianManagementController.GetClientById(Guid clientId)
   around line 304

Your task:
1. Audit every request triggered by `/dashboard`
   especially:
   - /api/dietitian/dashboard/stats
   - /api/dietitian/dashboard/activity
   - summary/limit endpoints
   - any appointments / settings / care-hub bootstrap calls used on dashboard
2. Find exactly which backend endpoint(s) are failing and why.
3. Fix the real backend cause, not just frontend symptoms.
4. Pay special attention to EF Core concurrency / shared DbContext misuse:
   - Task.WhenAll on EF queries
   - multiple async DB operations on the same scoped AppDbContext
   - deferred IQueryable execution mixed with later async calls
   - services/repositories called in parallel with one shared context
5. Refactor failing endpoints so DB reads are safe:
   - await sequentially
   - materialize first
   - only do parallel work after DB phase is complete
6. If dashboard stats depends on other services/queries, make them resilient to missing/null data instead of throwing.
7. Improve frontend dashboard error handling:
   - do not spam the same toast multiple times
   - allow partial widget rendering if one widget fails
   - show per-widget fallback instead of collapsing the entire dashboard
8. Preserve existing UI design and auth behavior.

Very important:
- Do NOT blame tunnel unless logs prove transport failure.
- Do NOT hide exceptions with generic catch blocks.
- Do NOT return fake data.
- Fix the actual failing controller/service/repository logic.
- Minimal correct change, production-safe.

Expected deliverables:
1. Apply code changes directly.
2. Give me a concise Turkish summary:
   - which exact dashboard endpoints were failing
   - backend root cause
   - which files changed
   - how the DbContext/concurrency issue was fixed
   - how duplicate toast spam was reduced
3. Mention whether any other nearby endpoints still use risky parallel EF patterns.

Acceptance criteria:
- /dashboard loads reliably
- /api/dietitian/dashboard/stats no longer returns 503
- dashboard widgets do not randomly disappear
- repeated identical error toasts are gone
- backend no longer throws "A second operation was started on this context instance before a previous operation completed."



Use the existing logs as source of truth:
- frontend: /api/dietitian/dashboard/stats -> 503
- backend: EF Core concurrency exception in DietitianManagementController.GetClientById line ~304
These are likely connected through dashboard bootstrap flows and shared context misuse.