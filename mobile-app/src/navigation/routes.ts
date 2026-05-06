/**
 * Centralized route constants
 * All navigation should use these constants instead of string literals
 */
export const Routes = {
  Auth: {
    Welcome: 'Welcome',
    Login: 'Login',
    Register: 'Register',
  },
  Free: {
    Home: 'FreeHome',
    ActivatePremium: 'ActivatePremium',
  },
  Premium: {
    Today: 'Today',
    CheckIngredients: 'CheckIngredients',
    AlternativeResult: 'AlternativeResult',
  },
  App: {
    Shell: 'Shell',
    Today: 'Today',
    Hydration: 'Hydration',
    CheckIngredients: 'CheckIngredients',
    AlternativeResult: 'AlternativeResult',
    KitchenResult: 'KitchenResult',
    RecipeDetail: 'RecipeDetail',
    CookingMode: 'CookingMode',
    GameCenter: 'GameCenter',
    Favorites: 'Favorites',
    ProfileMeasurements: 'ProfileMeasurements',
    ProfileNotifications: 'ProfileNotifications',
    ProfileFeedback: 'ProfileFeedback',
    ShoppingList: 'ShoppingList',
    GoalPreferences: 'GoalPreferences',
    Privacy: 'Privacy',
    RateApp: 'RateApp',
    IngredientScan: 'IngredientScan',
    ReceiptScan: 'ReceiptScan',
    Pantry: 'Pantry',
    BarcodeScan: 'BarcodeScan',
    WeeklySummary: 'WeeklySummary',
    MealLog: 'MealLog',
    BadgeVault: 'BadgeVault',
    ChangePassword: 'ChangePassword',
  },
  Modal: {
    ActivatePremium: 'ModalActivatePremium',
  },
} as const;

// Type helper for route names
export type RouteName =
  | typeof Routes.Auth[keyof typeof Routes.Auth]
  | typeof Routes.Free[keyof typeof Routes.Free]
  | typeof Routes.Premium[keyof typeof Routes.Premium]
  | typeof Routes.App[keyof typeof Routes.App];

