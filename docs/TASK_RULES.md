# TASK_RULES

## Purpose
This file defines how coding assistants should work on this repository.

The main goal is:
- protect working code
- reduce cost
- reduce scope drift
- keep progress measurable

---

## General Rules

### Rule 1
Do not start coding immediately.
First:
- inspect
- summarize
- identify affected files
- identify risk

### Rule 2
Prefer small scoped tasks.
Avoid “big rewrite” behavior.

### Rule 3
Do not redesign UI unless explicitly asked.
Do not broaden product scope without approval.

### Rule 4
Preserve the thesis core:
- ingredient normalization
- taxonomy
- recommendation engine
- evaluation/logging

Do not accidentally turn the project into a generic recipe app.

### Rule 5
Database-backed truth is preferred over superficial UI assumptions.

### Rule 6
If a change affects persistence, routes, DTOs, or matching logic:
- verify with tests or real local API calls
- do not claim success from code reading alone

---

## Expected Task Output Format
For every completed task, provide:
1. what changed
2. why it changed
3. affected files
4. how it was verified
5. what remains risky or unverified

---

## What to Avoid
- broad refactors without approval
- renaming large areas without need
- replacing stable behavior for style reasons
- demo-only hacks that hide real broken logic
- adding external-provider dependencies unless requested
- pretending presentation-only modules are complete

---

## Preferred Work Order
1. audit
2. smallest fix
3. test/build
4. API verification
5. UI verification
6. report truthfully

---

## If Something Is Incomplete
Say it clearly.

Use phrases like:
- production-near
- stable internal
- presentation-only
- incomplete
- unverified externally

Do not overclaim.

---

## Special Product Guidance
The recommendation engine is the product core.
Dietitians should not be framed as manually matching recipes as the primary workflow.

If editing recipe match pages:
- treat them as simulation/inspection surfaces unless explicitly redefining product behavior