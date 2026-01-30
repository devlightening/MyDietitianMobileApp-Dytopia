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
  Modal: {
    ActivatePremium: 'ModalActivatePremium',
  },
} as const;

// Type helper for route names
export type RouteName = 
  | typeof Routes.Auth[keyof typeof Routes.Auth]
  | typeof Routes.Free[keyof typeof Routes.Free]
  | typeof Routes.Premium[keyof typeof Routes.Premium];
