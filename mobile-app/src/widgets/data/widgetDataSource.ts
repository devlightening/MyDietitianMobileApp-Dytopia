import { getAppointments } from "../../api/care";
import { getTodayTracking } from "../../api/progress";
import { getDashboardData } from "../../data/dashboardRepo";
import { getNextMeal, getTodayPlan } from "../../data/plansRepo";
import {
  buildDailySummaryWidgetSnapshot,
  buildHydrationWidgetSnapshot,
} from "./widgetMappers";
import type { WidgetSnapshotBundle } from "../types";

async function safeValue<T>(factory: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await factory();
  } catch {
    return fallback;
  }
}

export async function getWidgetSnapshotBundle(
  isPremium: boolean,
): Promise<WidgetSnapshotBundle> {
  const [dashboard, tracking, nextMeal, todayPlan, appointments] =
    await Promise.all([
      safeValue(() => getDashboardData(), null),
      safeValue(() => getTodayTracking(), null),
      isPremium ? safeValue(() => getNextMeal(), null) : Promise.resolve(null),
      isPremium ? safeValue(() => getTodayPlan(), null) : Promise.resolve(null),
      isPremium ? safeValue(() => getAppointments(), []) : Promise.resolve([]),
    ]);

  const payload = {
    dashboard,
    tracking,
    nextMeal,
    todayPlan,
    appointments,
  };

  return {
    hydration: buildHydrationWidgetSnapshot(payload),
    dailySummary: buildDailySummaryWidgetSnapshot(payload),
  };
}
