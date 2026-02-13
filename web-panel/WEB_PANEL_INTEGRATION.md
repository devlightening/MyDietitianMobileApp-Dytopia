# Web Panel Integration Guide

## API Client Setup

### Base Configuration

The web panel uses a centralized API client (`lib/api.ts`) with the following features:

- **Base URL:** Empty string (same-origin via Next.js rewrites)
- **Cookie Auth:** `withCredentials: true` for automatic cookie handling
- **401/403 Interceptor:** Auto-redirect to `/auth/login` on auth errors

### API Modules

All API functions are organized by domain:

#### Authentication (`lib/auth-api.ts`)
```typescript
import { dietitianLogin, dietitianRegister } from '@/lib/auth-api';

// Login
const result = await dietitianLogin({ email, password });

// Register
await dietitianRegister({ fullName, clinicName, email, password });
```

#### Client Management (`lib/api/clients.ts`)
```typescript
import { getClients, getClientById, getClientMeasurements } from '@/lib/api/clients';

// List all clients
const { clients } = await getClients();

// Get client details (IDOR protected)
const client = await getClientById(clientId);

// Get measurements
const { measurements } = await getClientMeasurements(clientId, 30); // last 30 days
```

#### Access Keys (`lib/api/access-keys.ts`)
```typescript
import { getAccessKeys, createAccessKeyForClient, revokePremium } from '@/lib/api/access-keys';

// List access keys
const { accessKeys } = await getAccessKeys();

// Create new access key (canonical route)
const { accessKey } = await createAccessKeyForClient(publicUserId, {
  startDate: '2026-02-13',
  endDate: '2026-03-13'
});

// Revoke premium
await revokePremium(publicUserId);
```

#### Diet Plans (`lib/api/diet-plans.ts`)
```typescript
import { 
  createDietPlan, 
  getDietPlanByClient, 
  updateDietPlan,
  publishDietPlan,
  duplicateDietPlan,
  deleteDietPlan 
} from '@/lib/api/diet-plans';

// Create plan
const result = await createDietPlan(planData);

// Get client's plan
const plan = await getDietPlanByClient(clientId);

// Publish plan
await publishDietPlan(planId);

// Duplicate plan
const { newPlanId } = await duplicateDietPlan(planId, '2026-03-01');
```

#### Recipes (`lib/api/recipes.ts`)
```typescript
import { 
  getRecipes, 
  getRecipeById, 
  createRecipe, 
  updateRecipe, 
  deleteRecipe 
} from '@/lib/api/recipes';

// List recipes
const { recipes } = await getRecipes();

// Create recipe
const recipe = await createRecipe({
  name: 'Salad',
  description: 'Healthy salad',
  isPublic: true,
  ingredients: [{ ingredientId: '...', quantity: 100, unit: 'g' }]
});
```

---

## Freemium/Premium UX

### Premium Error Handling

Use `premium-utils.ts` for graceful degradation:

```typescript
import { isPremiumRequired, getPremiumErrorMessage, safeApiCall } from '@/lib/premium-utils';

try {
  await someApiCall();
} catch (error) {
  if (isPremiumRequired(error)) {
    // Show upgrade banner instead of error
    showUpgradeBanner(getPremiumErrorMessage(error));
  } else {
    // Handle other errors
    showError(error);
  }
}
```

### Safe API Calls with Fallbacks

```typescript
import { safeApiCall, DEFAULT_BRANDING } from '@/lib/premium-utils';

// Free users get default branding, premium users get custom branding
const branding = await safeApiCall(
  () => getBranding(),
  DEFAULT_BRANDING
);
```

### Null-Safe UI Components

```typescript
// Dietitian info might be null for free users
const dietitianInfo = await getDietitianInfo();

if (dietitianInfo) {
  // Show dietitian details
} else {
  // Show "No dietitian assigned" or hide section
}
```

---

## Minimum Working Panel Flow

### 1. Login Flow

```typescript
// app/auth/login/page.tsx
import { dietitianLogin } from '@/lib/auth-api';

async function handleLogin(email: string, password: string) {
  try {
    await dietitianLogin({ email, password });
    // Cookie is set automatically
    router.push('/dashboard');
  } catch (error) {
    setError('Invalid credentials');
  }
}
```

### 2. Clients List

```typescript
// app/dashboard/clients/page.tsx
import { getClients } from '@/lib/api/clients';

const { clients } = await getClients();

return (
  <div>
    {clients.map(client => (
      <ClientCard 
        key={client.id}
        client={client}
        onClick={() => router.push(`/dashboard/clients/${client.id}`)}
      />
    ))}
  </div>
);
```

### 3. Client Detail

```typescript
// app/dashboard/clients/[clientId]/page.tsx
import { getClientById, getClientMeasurements } from '@/lib/api/clients';

const client = await getClientById(params.clientId);
const { measurements } = await getClientMeasurements(params.clientId, 30);

return (
  <div>
    <h1>{client.fullName}</h1>
    <PremiumBadge isPremium={client.isPremium} />
    <MeasurementsChart data={measurements} />
  </div>
);
```

### 4. Access Key Management

```typescript
// app/dashboard/access-keys/page.tsx
import { getAccessKeys, createAccessKeyForClient } from '@/lib/api/access-keys';

async function handleCreateKey(publicUserId: string) {
  const { accessKey } = await createAccessKeyForClient(publicUserId, {
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  });
  
  // Show access key to user
  alert(`Access Key: ${accessKey}`);
}
```

### 5. Plan Builder

```typescript
// app/dashboard/plan-builder/page.tsx
import { createDietPlan, publishDietPlan } from '@/lib/api/diet-plans';

async function handleCreatePlan(planData: any) {
  const result = await createDietPlan(planData);
  
  // Publish immediately or save as draft
  if (shouldPublish) {
    await publishDietPlan(result.planId);
  }
  
  router.push(`/dashboard/clients/${planData.clientId}`);
}
```

### 6. Recipe Management

```typescript
// app/dashboard/recipes/page.tsx
import { getRecipes, createRecipe, deleteRecipe } from '@/lib/api/recipes';

const { recipes } = await getRecipes();

async function handleCreateRecipe(data: any) {
  await createRecipe(data);
  router.refresh();
}

async function handleDeleteRecipe(recipeId: string) {
  await deleteRecipe(recipeId);
  router.refresh();
}
```

---

## Canonical Endpoints Reference

### Authentication
- `POST /api/auth/dietitian/login`
- `POST /api/auth/dietitian/register`

### Clients
- `GET /api/dietitian/clients`
- `GET /api/dietitian/clients/{clientId}`
- `GET /api/dietitian/clients/{clientId}/measurements`

### Access Keys
- `GET /api/dietitian/access-keys`
- `POST /api/dietitian/clients/{publicUserId}/access-key`
- `DELETE /api/dietitian/clients/{publicUserId}/premium`

### Diet Plans
- `POST /api/dietitian/plans`
- `GET /api/dietitian/plans/client/{clientId}`
- `PUT /api/dietitian/plans/{planId}`
- `POST /api/dietitian/plans/{planId}/publish`
- `POST /api/dietitian/plans/{planId}/duplicate`
- `DELETE /api/dietitian/plans/{planId}`

### Recipes
- `GET /api/dietitian/recipes`
- `POST /api/dietitian/recipes`
- `GET /api/dietitian/recipes/{recipeId}`
- `PUT /api/dietitian/recipes/{recipeId}`
- `DELETE /api/dietitian/recipes/{recipeId}`

---

## Error Handling Best Practices

### 1. Premium Required (403 + PREMIUM_REQUIRED)

```typescript
import { isPremiumRequired } from '@/lib/premium-utils';

try {
  await getPremiumFeature();
} catch (error) {
  if (isPremiumRequired(error)) {
    return <UpgradeBanner message={error.message} />;
  }
  throw error;
}
```

### 2. Authentication Error (401/403)

Automatically handled by API interceptor - redirects to `/auth/login`

### 3. Not Found (404)

```typescript
const client = await getClientById(clientId);
if (!client) {
  return <NotFound message="Client not found" />;
}
```

### 4. Validation Error (400)

```typescript
try {
  await createRecipe(data);
} catch (error) {
  if (error.status === 400) {
    setFieldErrors(error.message);
  }
}
```

---

## Next Steps

1. ✅ API client configured with cookie auth
2. ✅ 401/403 interceptor redirects to login
3. ✅ All canonical endpoints wrapped in TypeScript functions
4. ✅ Premium UX utilities for graceful degradation
5. 🔄 Implement login page
6. 🔄 Implement clients list
7. 🔄 Implement client detail page
8. 🔄 Implement access key management
9. 🔄 Implement plan builder
10. 🔄 Implement recipe CRUD

**Backend is FROZEN - Web panel can now be built against stable API!**
