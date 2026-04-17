Fix the Vercel production deployment for the web-panel in MyDietitianMobileApp.

Problem:
- Custom domain setup is now correct
- Cloudflare DNS is correctly configured
- Vercel domain mapping is valid
- But all production routes return Vercel 404 NOT_FOUND:
  - /
  - /login
  - /dashboard
  - /auth/login
- This means the deployed web-panel app is not serving valid production routes

Important context:
- Repo is a monorepo
- Vercel root directory is `web-panel`
- Framework is Next.js
- Local development routes work
- Production deployment returns 404 for everything
- Earlier deployment overview already showed a NOT_FOUND thumbnail, so this is not just a custom domain problem

Your task:
1. Inspect the entire web-panel routing structure
2. Verify whether the project uses App Router or Pages Router
3. Confirm the expected production entry routes actually exist
4. Inspect:
   - app/page.tsx
   - app/login/page.tsx
   - app/dashboard/page.tsx
   - app/auth/login/page.tsx
   - or equivalent pages-router files
5. Inspect middleware.ts very carefully:
   - matcher
   - redirects
   - auth checks
   - route exclusions
6. Inspect next.config.* for:
   - basePath
   - rewrites
   - redirects
   - output settings
   - trailingSlash
   - experimental flags
7. Inspect Vercel-related config/files if any
8. Find the real root cause of why production serves NOT_FOUND for all routes
9. Apply the minimal correct fix so production serves valid pages again
10. Ensure these routes work after fix:
   - /
   - /login (or intentional redirect target)
   - /dashboard
11. Preserve existing auth logic and app structure
12. Do not use hacks or dummy static pages unless absolutely necessary

Expected implementation approach:
- If no valid root route exists, add one intentionally
- If root should redirect, implement a real route-based redirect
- If middleware is breaking routing, fix matcher/logic
- If route groups are causing production misses, refactor safely
- If build output is wrong due to config, fix config properly

Deliverables:
1. Apply the code changes directly
2. Give me a concise Turkish summary:
   - root cause
   - changed files
   - what now serves on /
   - what now serves on /login and /dashboard
   - why production no longer returns 404
3. Mention whether the Vercel project settings should be changed further

Acceptance criteria:
- Vercel production deployment no longer returns NOT_FOUND on all routes
- Domain and vercel.app URL both serve the actual web panel
- At least one public entry route and one authenticated entry route work correctly