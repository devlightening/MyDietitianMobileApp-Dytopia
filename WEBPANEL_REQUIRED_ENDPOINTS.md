# Web Panel Required Endpoints

This document lists all API endpoints required by the web panel for full functionality.

---

## Authentication

### Dietitian Login
- **POST** `/api/auth/dietitian/login`
- **Body:** `{ email: string, password: string }`
- **Response:** Sets `access_token` cookie

### Dietitian Register
- **POST** `/api/auth/dietitian/register`
- **Body:** `{ email: string, password: string, fullName: string, clinicName?: string }`
- **Response:** `{ ok: true }`

---

## Client Management

### List All Clients
- **GET** `/api/dietitian/clients`
- **Auth:** Dietitian
- **Response:** Array of client summaries with premium status

### Get Client Details
- **GET** `/api/dietitian/clients/{clientId}`
- **Auth:** Dietitian
- **IDOR Protection:** ✅ Verified
- **Response:** Full client details including profile, measurements, premium status

### Get Client Measurements
- **GET** `/api/dietitian/clients/{clientId}/measurements`
- **Auth:** Dietitian
- **Query Params:** `lastNDays?: number`
- **Response:** Array of measurements with BMI, BMR, weight, height

---

## Access Key Management

### List Access Keys
- **GET** `/api/dietitian/access-keys`
- **Auth:** Dietitian
- **Response:** Array of all access keys created by dietitian

### Create Access Key for Client
- **POST** `/api/dietitian/clients/{publicUserId}/access-key`
- **Auth:** Dietitian
- **Body:** `{ startDate: string, endDate: string }`
- **Response:** `{ accessKey: string, ... }`

### Create Access Key (Legacy)
- **POST** `/api/dietitian/access-keys`
- **Auth:** Dietitian
- **Body:** `{ publicUserId: string, startDate: string, endDate: string }`
- **Response:** `{ accessKey: string, ... }`

### Revoke Client Premium
- **DELETE** `/api/dietitian/clients/{publicUserId}/premium`
- **Auth:** Dietitian
- **Response:** `{ success: true }`

---

## Plan Management

### Create Meal Plan
- **POST** `/api/dietitian/plans`
- **Auth:** Dietitian
- **Body:** Plan structure with days and meals
- **Response:** Created plan ID

### Get Client's Active Plan
- **GET** `/api/dietitian/plans/client/{clientId}`
- **Auth:** Dietitian
- **Response:** Active plan with all days and meals

### Update Plan
- **PUT** `/api/dietitian/plans/{planId}`
- **Auth:** Dietitian
- **Body:** Updated plan structure
- **Response:** Updated plan

### Publish Plan
- **POST** `/api/dietitian/plans/{planId}/publish`
- **Auth:** Dietitian
- **Response:** `{ success: true }`

### Duplicate Plan
- **POST** `/api/dietitian/plans/{planId}/duplicate`
- **Auth:** Dietitian
- **Body:** `{ newStartDate: string }`
- **Response:** New plan ID

### Delete Plan
- **DELETE** `/api/dietitian/plans/{planId}`
- **Auth:** Dietitian
- **Response:** `{ success: true }`

---

## Recipe Management

### List Dietitian Recipes
- **GET** `/api/dietitian/recipes`
- **Auth:** Dietitian
- **Response:** Array of recipes with ingredients

### Create Recipe
- **POST** `/api/dietitian/recipes`
- **Auth:** Dietitian
- **Body:** `{ name: string, description: string, ingredients: [...] }`
- **Response:** Created recipe

### Get Recipe Details
- **GET** `/api/dietitian/recipes/{recipeId}`
- **Auth:** Dietitian
- **Response:** Full recipe with ingredients

### Update Recipe
- **PUT** `/api/dietitian/recipes/{recipeId}`
- **Auth:** Dietitian
- **Body:** Updated recipe structure
- **Response:** Updated recipe

### Delete Recipe
- **DELETE** `/api/dietitian/recipes/{recipeId}`
- **Auth:** Dietitian
- **Response:** `{ success: true }`

---

## Reporting & Analytics

### Client Activity Report
- **GET** `/api/dietitian/reporting/client-activity`
- **Auth:** Dietitian
- **Query Params:** `clientId?: Guid, from?: string, to?: string`
- **Response:** Activity events and statistics

### Compliance Summary
- **GET** `/api/dietitian/reporting/compliance-summary`
- **Auth:** Dietitian
- **Query Params:** `clientId?: Guid, from?: string, to?: string`
- **Response:** Compliance metrics and trends

### Dietitian Dashboard
- **GET** `/api/dietitian/dashboard`
- **Auth:** Dietitian
- **Response:** Overview statistics (active clients, compliance, recent activity)

---

## Branding

### Get Branding Config
- **GET** `/api/dietitian/branding`
- **Auth:** Dietitian
- **Response:** Branding configuration (logo, colors, clinic name)

### Update Branding
- **PUT** `/api/dietitian/branding`
- **Auth:** Dietitian
- **Body:** `{ clinicName: string, logoUrl?: string, primaryColorHex: string, accentColorHex: string }`
- **Response:** Updated branding

---

## Notes

### Get Client Notes
- **GET** `/api/dietitian/notes/client/{clientId}`
- **Auth:** Dietitian
- **Response:** Array of notes for client

### Create Note
- **POST** `/api/dietitian/notes`
- **Auth:** Dietitian
- **Body:** `{ clientId: Guid, content: string }`
- **Response:** Created note

### Update Note
- **PUT** `/api/dietitian/notes/{noteId}`
- **Auth:** Dietitian
- **Body:** `{ content: string }`
- **Response:** Updated note

### Delete Note
- **DELETE** `/api/dietitian/notes/{noteId}`
- **Auth:** Dietitian
- **Response:** `{ success: true }`

---

## Ingredients (Shared)

### Search Ingredients
- **GET** `/api/ingredients/search`
- **Auth:** Dietitian
- **Query Params:** `q: string`
- **Response:** Array of matching ingredients

### List All Ingredients
- **GET** `/api/ingredients`
- **Auth:** Dietitian
- **Response:** Array of all active ingredients

---

## Summary

**Total Endpoints Required:** 28

**By Category:**
- Authentication: 2
- Client Management: 3
- Access Keys: 4
- Plans: 6
- Recipes: 5
- Reporting: 3
- Branding: 2
- Notes: 4
- Ingredients: 2

**All endpoints use JWT authentication via `access_token` cookie.**
