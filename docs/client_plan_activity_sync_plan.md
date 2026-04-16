# Client Detail Plan + Activity Sync Master Plan

## Context
This plan targets the gaps observed in the current `client detail` flow across the **web panel** and **mobile app**.

Reviewed inputs:
- client detail screenshots
- plan tab empty / broken states
- activities tab behavior
- mobile `Planım / Tüm Planlarım` placement
- `İstenen kayıt bulunamadı` toast issue
- requirement that client-specific actions should appear in that client's timeline

The goal is to make the experience feel like a real dietitian workflow rather than a set of disconnected tabs.

---

## Core Problems Observed

### 1. Client detail header is still weak
Current header still behaves like a generic profile card instead of a clinical control surface.

Problems:
- too little actionable information
- no compact plan status summary
- no “last activity” / “last measurement” / “active plan range” summary
- premium badge exists, but the rest of the header is too empty

### 2. Plan tab is only partially useful
Current plan tab shows an empty state and some plan history, but it is not yet a real management surface.

Problems:
- `Plan ata` flow is not fully reliable
- assigned plan is not shown as an editable, inspectable object for this specific client
- plan history exists visually but does not feel deeply connected to the client lifecycle
- `İstenen kayıt bulunamadı` toast appears during expected states and should not surface in normal UX

### 3. Activity tab is under-modeled
There is already a general “live feed / all clients” style activity experience elsewhere, but the **client detail activity tab** must show **only that client’s events**, in **time order**, with rich event typing.

Problems:
- client-specific activity feed is empty or non-functional
- plan assignment / plan update events are not represented clearly
- mobile actions are not flowing into a client-specific event timeline
- timeline is not yet a proper audit + engagement surface

### 4. Mobile “My Plans” placement is weak
On mobile, the client’s assigned plan currently sits under a `Tüm Planlarım` section, but the user expectation is stronger:
- if there is an active plan, it should be visible on the mobile home/dashboard area
- it should feel like the main actionable object of the day/week
- users should not need to hunt for the active plan

### 5. Plan synchronization is incomplete
When a dietitian assigns or updates a plan on web:
- the mobile home should reflect it
- mobile plan listing should reflect it
- the client detail page should show it
- the client activity timeline should record it

Right now these are not behaving like one connected system.

---

## Product Decision

### A. Client detail page should become the “patient workspace”
The page at:
`/dashboard/clients/[clientId]`
should be treated as the main longitudinal workspace for a specific client.

It should answer these questions immediately:
- Who is this client?
- Is there an active plan?
- What changed recently?
- Is the client engaging with meals / plans / recipes?
- What is the latest clinically relevant update?

### B. Activity feed should be **client-scoped** and **event-driven**
The activity tab must not be a reused generic feed. It must be built from a client-specific event source.

### C. Active plan should surface in both web and mobile as a first-class object
An active plan is not just history. It is the current treatment/program artifact.

### D. “Not found” is not always an error
If a client simply does not yet have an active plan, no scary toast should appear. That is a valid empty state, not an exception.

---

## Required Outcomes

1. Assigning a plan to a client works end-to-end.
2. The assigned plan appears in:
   - web client detail / plan tab
   - mobile home
   - mobile my plans
3. Updating a client plan creates a visible change in the client activity timeline.
4. Client activity tab shows only that client’s events.
5. Events are time-based and ordered.
6. `İstenen kayıt bulunamadı` disappears for expected empty states.
7. Client plan becomes editable from the client detail page.
8. Mobile home shows an elegant “Active Plan” block if there is one.

---

## Functional Scope

# 1. Web Panel — Client Header Upgrade

## Replace current sparse header with a compact clinical summary band
Header should include:
- full name
- email
- premium badge
- active plan status (`Aktif plan var / Plan yok`)
- active plan name if assigned
- plan date range if assigned
- latest measurement date if exists
- last activity date if exists
- quick actions:
  - `Plan ata`
  - `Planı düzenle`
  - `Mesaj gönder`
  - optionally `Ölçüm ekle`

## Visual behavior
- if active plan exists, header should show a green-accent summary chip
- if no plan exists, header should show a calm neutral state, not an error state

---

# 2. Web Panel — Plan Tab Redesign

## Empty state
If no active plan exists:
- show a friendly empty state
- show two primary actions:
  - `Şablondan ata`
  - `Yeni plan oluştur`
- do **not** show error toast

## Active plan state
If active plan exists, show:
- plan name
- start / end dates
- completion summary (`kaç öğün / kaç tamamlandı`)
- linked meals / meal groups
- source (`şablondan atandı` / `sıfırdan oluşturuldu`)
- last updated time
- CTA buttons:
  - `Planı düzenle`
  - `Şablon olarak kaydet`
  - `Danışana gönder / yenile`

## Plan edit flow
Dietitian should be able to open an edit surface **from the client detail page**.

Preferred implementation:
- open side drawer or full-page editor pre-bound to this client
- avoid forcing the user to navigate away without context

## Plan history
History should remain, but be upgraded:
- each historical plan card should show:
  - title
  - date range
  - status (`aktif`, `tamamlandı`, `arşiv`)
  - meal count
  - completion count
- add actions:
  - `incele`
  - `kopyalayarak yeniden ata`

---

# 3. Web Panel — Fix `İstenen kayıt bulunamadı`

## Problem
This toast currently appears when expected empty states happen.
That should not happen for:
- no active plan
- no activities yet
- no measurements yet

## Required fix
Differentiate API responses:
- `404 because resource truly invalid` → real error toast
- `no active plan for valid client` → return safe empty payload, no toast
- `no activities yet` → empty timeline card, no toast

## Backend/API decision
For expected empty states, return structured empty responses, for example:

```json
{
  "hasActivePlan": false,
  "activePlan": null,
  "history": []
}
```

No exception-driven UX for valid empties.

---

# 4. Web Panel — Client Activity Tab Redesign

## Product goal
This tab should answer:
**“What has this specific client done recently?”**

## Event model
Introduce or fully use a `ClientActivityEvent` model/table if not already present.
Each event should include at least:
- `Id`
- `ClientId`
- `EventType`
- `OccurredAtUtc`
- `Title`
- `Description`
- `MetadataJson`
- `ActorType` (`client`, `dietitian`, `system`)
- `ActorDisplayName` optional
- `RelatedEntityType` optional
- `RelatedEntityId` optional

## Event types to support
At minimum:
- `plan_assigned`
- `plan_updated`
- `plan_started`
- `meal_completed`
- `meal_skipped`
- `recipe_viewed`
- `recipe_search`
- `alternative_recipe_used`
- `measurement_added`
- `weight_logged`
- `badge_earned`
- `message_sent`
- `message_read`
- `ingredient_scan_confirmed`

## Feed rules
- only events for the current client
- reverse chronological order
- grouped by day where appropriate
- rich icon + color by event type
- concise but informative description

### Example cards
- `Selin Aydın planı başlattı` — 2 sa önce
- `Selin Aydın öğünü tamamladı: Akşam / Fırında Somon ve Sebze` — 13 dk önce
- `Selin Aydın yeni rozet kazandı: Kitchen Spark` — 5 sa önce
- `Diyetisyen planı güncelledi: Bu Haftanın En İyisi` — 1 gün önce
- `Selin Aydın ölçüm ekledi: 78.4 kg` — 2 gün önce

## Filters
Add light filters:
- all
- plan
- meals
- measurements
- engagement
- achievements

---

# 5. Mobile — Move Active Plan to Home

## Product decision
The active plan should not be hidden only inside `Tüm Planlarım`.
It should also appear on the mobile home/dashboard.

## Required UI block on home
If active plan exists, show a prominent home card:
- title: `Aktif Planın`
- plan name
- date range
- current progress (`ör. 3/14 öğün tamamlandı`)
- quick actions:
  - `Planı aç`
  - `Bugünkü öğünlere git`

## If no active plan
Show a softer empty state:
- `Henüz aktif bir planın yok`
- optionally encourage contacting the dietitian

## Keep `Tüm Planlarım`
Do not remove historical plans page. Instead:
- mobile home = current active plan summary
- my plans page = full list + history

---

# 6. Mobile — Plan Screen Improvements

## Active plan card
Improve the visual design of plan cards:
- stronger hierarchy
- clearer date range
- progress indicator
- current status badge
- dietitian assignment context if useful

## Behavior
When a plan is assigned/updated from web:
- mobile home should reflect it after refresh / query invalidation
- my plans list should reflect it
- if the assigned plan changes, old cached active plan should not linger incorrectly

---

# 7. Sync Rules Between Web and Mobile

## When dietitian assigns a plan
System must do all of the following:
1. create/update client active plan record
2. create `plan_assigned` activity event
3. mobile home active plan query reflects new plan
4. mobile plans list reflects new plan
5. client detail page header reflects new plan
6. client detail activity tab shows plan assignment event

## When dietitian edits a client plan
System must:
1. persist the new plan version
2. invalidate relevant plan queries
3. create `plan_updated` event
4. show updated summary in web + mobile

## When client completes meals
System must:
1. update compliance/completion records
2. create `meal_completed` event
3. surface event in client activity tab
4. update progress counters in plan summaries

## When client earns a badge
System must:
1. record badge event
2. surface it in client activity tab
3. optionally surface on web general overview summary

---

# 8. Backend/API Work Required

## Plan APIs
Review and standardize these flows:
- get client active plan
- get client plan history
- assign template plan to client
- create and assign new plan to client
- update existing assigned plan
- copy historical plan and reassign

## Required response shape
Client detail page should not depend on fragmented null-heavy endpoints.
Return a unified shape where possible:

```json
{
  "client": {
    "id": "...",
    "fullName": "Selin Aydın",
    "email": "selin.aydin@test.local",
    "premium": true,
    "latestMeasurementAtUtc": "...",
    "lastActivityAtUtc": "..."
  },
  "activePlan": {
    "id": "...",
    "title": "Bu Haftanın En İyisi",
    "status": "active",
    "startDate": "2026-04-15",
    "endDate": "2026-04-22",
    "completedMeals": 0,
    "totalMeals": 14
  },
  "planHistory": [...],
  "recentActivities": [...]
}
```

## Activity APIs
Needed endpoints:
- `GET /clients/{id}/activities`
- optional filters by type/date/page
- maybe `GET /clients/{id}/overview`

## Event writing points
Create activity events from these backend flows:
- plan assignment command
- plan update command
- meal completion endpoint
- measurement create endpoint
- badge / compliance achievement pipeline
- recipe search/recipe detail view if logged server-side
- scan confirmation endpoint

---

# 9. Web UX / UI Notes

## General look and feel
Dietitians should feel they are using a clinical dashboard, not a prototype.

### Improve:
- card spacing and hierarchy
- tab clarity
- empty state messaging
- active plan summary density
- client header information density
- activity icons and badges

## Avoid:
- raw technical identifiers in visible UI
- hard error toasts for expected empties
- duplicated timeline items without context
- dead CTA buttons

---

# 10. Data Integrity / Query Invalidations

When mutations succeed, invalidate these query groups at minimum:
- client detail overview
- active plan query
- plan history query
- client activities query
- mobile home summary query
- mobile my plans query
- compliance summary query

Stale cache is likely one reason why some screens feel disconnected.

---

# 11. Implementation Order for Claude

## Session 1 — Analyze and map current gaps
Read current files and report:
- current client detail page structure
- current plan tab handlers
- why `Plan ata` or related flows show `İstenen kayıt bulunamadı`
- how activities are currently sourced
- which mobile home screen file currently renders `Tüm Planlarım`

Do not code until this analysis is complete.

## Session 2 — Backend plan + activities foundation
Implement or fix:
- safe empty-state responses
- client activity event model and writers
- client-specific activity endpoint
- plan assign/update event emission

## Session 3 — Web panel client detail productization
Implement:
- improved header
- working plan tab
- editable active plan block
- better history cards
- client activity timeline
- remove false error toast

## Session 4 — Mobile home plan surfacing
Implement:
- active plan block on home
- stronger my plans cards
- proper sync with assigned plan

## Session 5 — End-to-end validation
Test scenario:
1. dietitian assigns plan to Selin
2. plan appears in web client detail
3. activity event appears in Selin’s activity tab
4. mobile home shows active plan
5. mobile my plans shows same plan
6. completing a meal generates activity event
7. no false `İstenen kayıt bulunamadı` toast in expected empty states

---

# 12. Acceptance Criteria

The task is complete only if all of these are true:

1. `Plan ata` works for a client.
2. Creating/assigning a plan produces a visible active plan block in the client plan tab.
3. Active plan can be edited from the client detail context.
4. Client activity tab shows only that client’s events.
5. Plan assignment and plan update appear in activity feed.
6. Mobile home displays active plan when available.
7. Mobile my plans remains available for history/full list.
8. Expected empty states do not produce `İstenen kayıt bulunamadı` toast.
9. Query/cache invalidation keeps web and mobile consistent.
10. UI looks production-ready and clinically useful.

---

# 13. Notes for Claude

- Do not solve this only visually. The event + sync model must be real.
- Do not keep dead buttons in the UI.
- Do not show generic not-found errors for valid empty states.
- Make the client detail page feel like the operational center for this specific client.
- Prefer real event creation over fake placeholder feed items.
- Preserve Turkish UI language consistency.

