# Mobile Store-Level Revision Plan

## Goal
Bring `mobile-app` closer to a polished App Store / Google Play release quality by aligning the product with:

- native-feeling navigation and safe-area behavior
- a single visual system across all screens
- content-first hierarchy instead of effect-first hierarchy
- complete i18n behavior for Turkish and English
- consistent loading, empty and error states

## Global Principles

1. Navigation should feel calm, predictable and easy to scan.
2. Every screen should have one clear primary action.
3. Decorative effects should support hierarchy, not compete with it.
4. Cards, spacing, radius and shadows should come from one shared system.
5. English mode must not leave Turkish strings behind.

## Priority Order

### Phase 1: Shell and Navigation
- Refine bottom bar size and active-state behavior
- Stabilize floating CTA / bottom safe-area spacing
- Replace “concept-like” floating labels with more native shell guidance
- Keep 5-tab navigation but reduce visual noise

### Phase 2: Kitchen Flow
- Rebuild `KitchenScreen` with stronger content hierarchy
- Keep ingredient input, quick packs and CTA in a clearer vertical structure
- Make `KitchenResultScreen` easier to scan with:
  - featured recipe
  - horizontal filter tabs
  - grouped result sections
- Upgrade `RecipeDetailScreen` into a clean reading flow

### Phase 3: Core Screens
- `DashboardScreen`: reduce copy clutter and make actions more product-like
- `PlansScreen`: tighten meal timeline and state grouping
- `MessagesScreen`: keep inbox behavior simple and readable
- `ProfileScreen`: make settings look native and structured

### Phase 4: Language and UX Polish
- Remove remaining hardcoded Turkish text from screens/components
- Ensure English mode is visually and semantically complete
- Standardize:
  - loading states
  - empty states
  - retry/error states
  - CTA wording

## Store-Level Quality Checklist

- Touch targets are comfortable and visually balanced
- Bottom navigation never fights the screen CTA
- Typography hierarchy is obvious at a glance
- Cards look like one family
- Visual density is controlled on small screens
- Premium / free states are understandable without explanation
- AI feeling is subtle and trustworthy, not flashy
- Turkish and English modes both feel complete

## Current Implementation Progress

- Bottom bar reduced and refined
- Kitchen orb received a softer AI-like animation
- Kitchen result filter switched to horizontal layout
- Kitchen result card system was simplified for readability
- App shell header moved toward a more product-like structure

## Remaining High-Impact Work

- Full `KitchenScreen` i18n cleanup
- `RecipeDetailScreen` redesign and hierarchy cleanup
- `DashboardScreen`, `PlansScreen`, `ProfileScreen` text and layout normalization
- Hardcoded string cleanup across screens
- Final pass for safe-area and spacing consistency
