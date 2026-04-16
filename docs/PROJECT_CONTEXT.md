# PROJECT_CONTEXT

## Project Name
MyDietitianMobileApp

## Core Goal
This project is not merely a mobile application or a web panel.

Its core engineering and thesis problem is:
- standardizing noisy free-text ingredient input
- modeling ingredient families, variants, and compatibility rules
- producing explainable, rule-based recipe recommendations from standardized data

The main value is:
**ingredient normalization + taxonomy-aware recommendation engine**

---

## Product Structure

### 1. Mobile App
Client-facing application.

Main responsibilities:
- ingredient input
- pantry / available ingredient flow
- premium-linked recipe access
- automatic recommendation display

### 2. Web Panel
Dietitian-facing SaaS panel.

Main responsibilities:
- recipe creation and editing
- client management
- premium/access key generation
- branding / clinic identity
- optional simulation and validation of recommendation output

### 3. Backend API
Main technical core.

Main responsibilities:
- auth
- ingredient normalization
- taxonomy management
- recommendation engine
- access key / premium link logic
- logging / benchmarking
- persistence

### 4. Database
Stores:
- users
- clients
- dietitians
- recipes
- ingredients
- ingredient family structures
- compatibility rules
- access keys
- logs
- plan-related data

---

## Correct Product Direction
The recommendation engine must be the primary actor.

Correct long-term flow:
1. Client enters ingredients in mobile.
2. System normalizes input.
3. System resolves linked dietitian / premium scope.
4. System selects available recipe pool.
5. Recommendation engine ranks suitable recipes.
6. Client sees:
   - best matches
   - missing ingredients
   - match percentage
   - explanation

Important:
The product should NOT rely on the dietitian manually selecting recipes one by one as the primary recommendation behavior.

If there is a recipe match page in the web panel, it should be treated as:
- simulation
- inspection
- debugging
- explanation surface
not as the main end-user flow.

---

## Core Technical Pillars

### Ingredient Normalization
Multi-layer matching:
1. canonical
2. alias
3. fuzzy
4. optional LLM fallback

### Ingredient Taxonomy
Ingredients are not only flat entities.
The system models:
- families
- members
- compatibility rules
- substitute-like relationships

### Recommendation Engine
Recipes are evaluated using:
- mandatory ingredients
- optional ingredients
- prohibited ingredients
- compatibility/substitute logic

### Evaluation and Observability
The system must remain measurable:
- normalization logs
- recommendation logs
- benchmark runner
- seedable datasets
- repeatable tests

---

## Academic Framing
This project should always be described as:
- a computer engineering solution to a specific data and recommendation problem
- not only as a UI application

Important thesis framing:
- problem definition
- method
- data model
- deterministic reasoning
- measurable evaluation