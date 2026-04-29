import type { NavigationProp, ParamListBase } from '@react-navigation/native';
import { Routes } from '../navigation/routes';

export interface CoachTask {
  actionKey: string;
  title: string;
  cta: string;
  body: string;
}

const taskPattern = /^\[TASK\|(?<action>[A-Z_]+)\|(?<title>[^\|\]]+)\|(?<cta>[^\]]+)\]\s*(?<body>.+)$/u;

export function parseCoachTask(text?: string | null): CoachTask | null {
  if (!text) return null;
  const match = text.trim().match(taskPattern);
  if (!match?.groups) return null;
  return {
    actionKey: match.groups.action.trim(),
    title: match.groups.title.trim(),
    cta: match.groups.cta.trim(),
    body: match.groups.body.trim(),
  };
}

export function isCoachTaskActionSupported(actionKey?: string | null): boolean {
  return actionKey === 'PANTRY' || actionKey === 'SHOPPING' || actionKey === 'HYDRATION';
}

export function runCoachTaskAction(
  navigation: NavigationProp<ParamListBase>,
  actionKey?: string | null,
): boolean {
  switch (actionKey) {
    case 'PANTRY':
      navigation.navigate(Routes.App.Pantry as never);
      return true;
    case 'SHOPPING':
      navigation.navigate(Routes.App.ShoppingList as never);
      return true;
    case 'HYDRATION':
      navigation.navigate(Routes.App.Hydration as never);
      return true;
    default:
      return false;
  }
}
