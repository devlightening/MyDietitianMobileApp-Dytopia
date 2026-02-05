export interface PlanItem {
  id: string;
  time: string;
  title: string;
  description: string;
  completed: boolean;
  category: "breakfast" | "lunch" | "dinner" | "snack";
}

export interface PlansData {
  todayPlans: PlanItem[];
  weekPlans: PlanItem[];
  isPremium: boolean;
}

/**
 * Get plans data for the current user
 * TODO: Replace with real API call to /api/client/plans
 */
export async function getPlansData(scope: "today" | "week" = "today"): Promise<PlansData> {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 300));

  // TODO: Replace with real API call
  // const response = await apiClient.get(`/api/client/plans?scope=${scope}`);
  // return response.data;

  // Mock data for now
  return {
    todayPlans: [
      {
        id: "1",
        time: "08:00",
        title: "Breakfast",
        description: "Oatmeal with berries and nuts",
        completed: true,
        category: "breakfast",
      },
      {
        id: "2",
        time: "12:00",
        title: "Lunch",
        description: "Grilled chicken salad",
        completed: false,
        category: "lunch",
      },
      {
        id: "3",
        time: "15:00",
        title: "Snack",
        description: "Apple & Walnuts",
        completed: false,
        category: "snack",
      },
      {
        id: "4",
        time: "19:00",
        title: "Dinner",
        description: "Salmon with vegetables",
        completed: false,
        category: "dinner",
      },
    ],
    weekPlans: [],
    isPremium: false,
  };
}
