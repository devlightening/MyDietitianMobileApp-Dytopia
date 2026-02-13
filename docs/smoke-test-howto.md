## Smoke Test How-To

### Running the smoke tests

- **PowerShell (Windows)**:

```powershell
./scripts/run-smoke-tests.ps1 -Configuration Release
```

- **Bash (macOS/Linux/WSL)**:

```bash
chmod +x scripts/run-smoke-tests.sh
./scripts/run-smoke-tests.sh Release
```

The tests use `WebApplicationFactory<Program>` with in-memory SQLite databases for both `AppDbContext` and `AuthDbContext`, so no external PostgreSQL instance is required.

### What the smoke suite covers

- **Endpoint inventory**:
  - Calls `/debug/endpoints` and generates `docs/endpoint-inventory.md` with method, route, and authorization info.
- **Auth flows**:
  - Client register/login via `/api/client/register` and `/api/client/login`, asserting JWT + auth cookie.
  - Dietitian register/login via `/api/auth/dietitian/register` and `/api/auth/dietitian/login`.
- **Auth protection basics**:
  - Verifies representative protected endpoints (client pantry, dietitian client list) return **401** without auth.
- **Premium gating (free client)**:
  - Logs in with a seeded “free” client and asserts premium home alias `/api/client/plan` is not accessible (401/403).
- **Dietitian access / IDOR**:
  - A placeholder test exists for dietitian/client IDOR prevention; it is currently marked **Skipped** until the test JWT/cookie pipeline is aligned end-to-end.

### Test data & environment

- **Database**:
  - Each run uses fresh in-memory SQLite databases; schema is created via `EnsureCreated()`.
- **Seed data** (via `SmokeTestSeeder`):
  - 2 dietitians (`dietitian1@smoke.local`, `dietitian2@smoke.local`).
  - 2 clients linked to those dietitians.
  - 1 additional free client (`freeclient@smoke.local`).
  - Passwords are simple but strong-enough patterns (e.g. `SmokeTest1!`, `SmokeFree1!`) aligned with the existing password rules.

### Regenerating the endpoint inventory

Running the smoke test project will automatically update `docs/endpoint-inventory.md` based on the current API shape by calling the `/debug/endpoints` diagnostic route.

