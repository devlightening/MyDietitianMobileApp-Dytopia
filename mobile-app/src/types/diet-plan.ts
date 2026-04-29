export enum MealType {
  Breakfast = 1,
  Lunch = 2,
  Dinner = 3,
  Snack = 4,
}

export interface TodayMeal {
  id: string;
  type: MealType;
  plannedRecipeId?: string;
  plannedRecipeName?: string;
  customName?: string;
  isMandatory: boolean;
}

export interface TodayPlan {
  date: string;
  dailyTargetCalories?: number;
  meals: TodayMeal[];
}

export function getMealTypeName(type: MealType): string {
  switch (type) {
    case MealType.Breakfast: return 'Kahvaltı';
    case MealType.Lunch: return 'Öğle';
    case MealType.Dinner: return 'Akşam';
    case MealType.Snack: return 'Ara Öğün';
  }
}

