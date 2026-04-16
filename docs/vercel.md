Fix the Vercel deployment failure for the web panel in the MyDietitianMobileApp monorepo.

Context:
- Repo contains a Next.js web panel under: web-panel
- Vercel project is configured with:
  - Framework: Next.js
  - Root Directory: web-panel
- Build compiles successfully, static pages generate successfully, but deployment fails at the end.

Actual Vercel error:
Error: ENOENT: no such file or directory, lstat '/vercel/path0/web-panel/.next/server/app/(dashboard)/page_client-reference-manifest.js'

Important observations:
- Next.js version: 14.2.35
- Build reaches:
  - Compiled successfully
  - Generating static pages ✅
  - Finalizing page optimization ✅
  - Collecting build traces ✅
- Then fails on missing manifest under:
  .next/server/app/(dashboard)/page_client-reference-manifest.js

Your task:
1. Inspect the web-panel app router structure, especially anything under app/(dashboard)
2. Find why Vercel expects page_client-reference-manifest.js for (dashboard) but it is missing
3. Fix the root cause in code or project structure, not with hacks
4. Check route groups, layouts, page.tsx files, client/server component boundaries, dynamic imports, and any custom Next/Vercel config
5. Check whether any script or config is interfering with .next output
6. Ensure the app can build correctly on Vercel with root directory web-panel
7. Keep existing functionality intact
8. Provide a concise Turkish summary of:
   - root cause
   - files changed
   - exact fix applied

Constraints:
- Do not remove major app features
- Do not downgrade the architecture unnecessarily
- Prefer minimal, correct fixes
- Code should remain in English
- Explanation to me should be in Turkish