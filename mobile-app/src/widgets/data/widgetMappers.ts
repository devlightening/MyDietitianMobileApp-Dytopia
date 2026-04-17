import type { AppointmentSummary } from "../../api/care";
import type { TodayTracking } from "../../api/progress";
import type { DashboardDTO } from "../../data/dashboardRepo";
import type { NextMeal, TodayPlan } from "../../data/plansRepo";
import {
  buildHydrationDeepLink,
  buildTodayDeepLink,
} from "../deepLinks";
import {
  DEFAULT_HYDRATION_GOAL_GLASSES,
  type DailySummaryTaskSnapshot,
  type DailySummaryWidgetSnapshot,
  type HydrationWidgetSnapshot,
} from "../types";

interface WidgetSourcePayload {
  dashboard: DashboardDTO | null;
  tracking: TodayTracking | null;
  nextMeal: NextMeal | null;
  todayPlan: TodayPlan | null;
  appointments: AppointmentSummary[];
}

function getCurrentGlasses(payload: WidgetSourcePayload): number {
  return (
    payload.tracking?.waterGlasses ??
    payload.dashboard?.summary?.waterGlasses ??
    0
  );
}

function getHydrationGoal(): number {
  return DEFAULT_HYDRATION_GOAL_GLASSES;
}

function getAdherencePercent(payload: WidgetSourcePayload): number {
  if (typeof payload.dashboard?.compliancePercent === "number") {
    return payload.dashboard.compliancePercent;
  }

  const totalMeals = payload.todayPlan?.items.length ?? 0;
  const completedMeals =
    payload.todayPlan?.items.filter((item) => item.completionStatus === "Done")
      .length ?? 0;

  if (totalMeals <= 0) {
    return 0;
  }

  return Math.round((completedMeals / totalMeals) * 100);
}

function buildTaskList(payload: WidgetSourcePayload): DailySummaryTaskSnapshot[] {
  const tasks: DailySummaryTaskSnapshot[] = [];
  const hydrationGoal = getHydrationGoal();
  const currentGlasses = getCurrentGlasses(payload);
  const remainingGlasses = Math.max(hydrationGoal - currentGlasses, 0);
  const nextAppointment = payload.appointments
    .filter((item) => new Date(item.scheduledAtUtc).getTime() > Date.now())
    .sort((left, right) =>
      new Date(left.scheduledAtUtc).getTime() - new Date(right.scheduledAtUtc).getTime(),
    )[0];

  if (payload.nextMeal?.mealItemId) {
    tasks.push({
      id: `meal:${payload.nextMeal.mealItemId}`,
      kind: "meal",
      title: payload.nextMeal.title,
      subtitle: `Due at ${payload.nextMeal.time}`,
      snoozeTitle: "Meal reminder",
      snoozeBody: `${payload.nextMeal.title} has been snoozed for 15 minutes.`,
    });
  }

  if (remainingGlasses > 0) {
    tasks.push({
      id: "hydration:goal",
      kind: "hydration",
      title: `${remainingGlasses} glasses left`,
      subtitle: `Goal ${currentGlasses}/${hydrationGoal}`,
      snoozeTitle: "Hydration reminder",
      snoozeBody: "Water reminder snoozed for 15 minutes.",
    });
  }

  if (nextAppointment) {
    const scheduled = new Date(nextAppointment.scheduledAtUtc);
    tasks.push({
      id: `appointment:${nextAppointment.id}`,
      kind: "appointment",
      title: nextAppointment.title,
      subtitle: `At ${scheduled.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
      snoozeTitle: "Appointment reminder",
      snoozeBody: `${nextAppointment.title} reminder snoozed for 15 minutes.`,
    });
  }

  return tasks.slice(0, 3);
}

export function buildHydrationWidgetSnapshot(
  payload: WidgetSourcePayload,
): HydrationWidgetSnapshot {
  const currentGlasses = getCurrentGlasses(payload);
  const goalGlasses = getHydrationGoal();
  const remainingGlasses = Math.max(goalGlasses - currentGlasses, 0);
  const progressPercent =
    goalGlasses > 0
      ? Math.min(100, Math.round((currentGlasses / goalGlasses) * 100))
      : 0;

  return {
    date: new Date().toISOString().slice(0, 10),
    currentGlasses,
    goalGlasses,
    remainingGlasses,
    progressPercent,
    progressLabel: `${currentGlasses} / ${goalGlasses} glasses`,
    statusLabel:
      remainingGlasses > 0
        ? `${remainingGlasses} glasses to goal`
        : "Hydration goal reached",
    lastUpdatedAt: new Date().toISOString(),
    deepLink: buildHydrationDeepLink(),
  };
}

export function buildDailySummaryWidgetSnapshot(
  payload: WidgetSourcePayload,
): DailySummaryWidgetSnapshot {
  const hydration = buildHydrationWidgetSnapshot(payload);
  const adherencePercent = getAdherencePercent(payload);
  const tasks = buildTaskList(payload);
  const nextMealTitle = payload.nextMeal?.title ?? "No next meal";
  const nextMealSubtitle = payload.nextMeal?.time
    ? `At ${payload.nextMeal.time}`
    : "Plan is clear for now";

  return {
    date: hydration.date,
    hydrationLabel: `Water: ${hydration.currentGlasses}/${hydration.goalGlasses}`,
    hydrationStatus: hydration.statusLabel,
    adherencePercent,
    adherenceLabel: `Meal adherence: ${adherencePercent}%`,
    nextMealTitle,
    nextMealSubtitle,
    nextMealId: payload.nextMeal?.mealItemId ?? null,
    pendingReminderCount: tasks.length,
    pendingReminderLabel:
      tasks.length === 1
        ? "1 pending reminder"
        : `${tasks.length} pending reminders`,
    tasks,
    deepLink: payload.nextMeal ? buildTodayDeepLink() : buildHydrationDeepLink(),
    fallbackDeepLink: buildTodayDeepLink(),
    lastUpdatedAt: new Date().toISOString(),
  };
}
