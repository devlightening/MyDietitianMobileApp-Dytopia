# ENGINEERING_PIPELINE

## Purpose
This document defines the standard development pipeline for this repository.

The goal is:
- faster iteration
- lower assistant cost
- less random exploration
- more reliable changes
- database-backed progress
- test-driven confidence

---

## Core Principle
Do NOT start with UI-first changes unless the backend/data behavior is already clear.

Preferred order:
1. data model
2. backend logic
3. tests
4. seed or fixture data
5. API verification
6. UI integration
7. final regression check

---

## Standard Change Pipeline

### Stage 1 — Understand Scope
Before making changes:
- read relevant docs
- identify affected modules
- confirm whether the task is backend, web, mobile, or cross-cutting
- identify whether the task changes product behavior or only implementation detail

### Stage 2 — Check Current Truth
Before editing:
- inspect current code path
- inspect endpoint or service path
- inspect DB entities if needed
- inspect current tests
- identify whether the behavior already exists partially

### Stage 3 — Implement Smallest Useful Change
Rules:
- keep scope minimal
- avoid broad refactors
- avoid changing stable flows unnecessarily
- prefer additive changes over risky rewrites

### Stage 4 — Verify at the Right Layer
Preferred verification order:
1. unit/integration tests
2. local backend API verification
3. database persistence verification
4. UI/browser verification only after lower layers succeed

### Stage 5 — Record Result
At the end of each task:
- what changed
- what was verified
- what remains unverified
- whether the feature is:
  - production-ready
  - internally usable
  - presentation-only
  - incomplete

---

## Required Commands for Most Tasks

### Backend-focused task
Run when relevant:
- dotnet build
- targeted dotnet test
- full dotnet test if the change is broad

### Web-focused task
Run when relevant:
- npm / pnpm build or type-check
- lint if configured
- local browser verification only after type/build is clean

### Database-focused task
Run when relevant:
- verify migration impact
- verify seed behavior
- verify actual inserted / updated data
- verify query behavior against real DB

---

## Data-First Rule
Do not rely on fake UI assumptions if the data path is not verified.

Preferred truth sources:
1. real local DB
2. real API responses
3. real persisted entities
4. repeatable tests

UI should be the last confirmation layer, not the first source of truth.

---

## Seed Data Policy
Seed data may be used for:
- local development
- stable verification scenarios
- repeatable integration tests
- smoke scenarios

But seed data must NOT be treated as proof that all real-world data problems are solved.

Correct interpretation:
- seed data validates architecture and key paths
- real-world edge cases still require ongoing handling

---

## When to Avoid Bigger Work
Do NOT expand scope when:
- a smaller fix is enough
- regression risk is high
- the module is already stable
- the task is near a deadline
- the task is primarily for assistant exploration, not product value

---

## Feature Readiness Labels
Use these labels consistently:

### PRODUCTION-NEAR
Core path works with DB, tests, and UI verification.

### STABLE INTERNAL
Works reliably in local/dev environment and is safe to continue building on.

### PRESENTATION-ONLY
Visible and safe to show, but not a fully complete feature.

### EXPERIMENTAL
Architecture exists, but not yet stable enough to depend on.