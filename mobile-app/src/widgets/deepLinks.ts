export const APP_DEEP_LINK_SCHEME = "dytopia";

export type WidgetDeepLinkTarget = "hydration" | "today";

export function buildHydrationDeepLink(): string {
  return `${APP_DEEP_LINK_SCHEME}://widget/hydration`;
}

export function buildTodayDeepLink(): string {
  return `${APP_DEEP_LINK_SCHEME}://widget/today`;
}

export function parseWidgetDeepLink(url: string): WidgetDeepLinkTarget | null {
  try {
    const parsed = new URL(url);
    const host = parsed.host.toLowerCase();
    const path = parsed.pathname.toLowerCase().replace(/^\/+/, "");

    if (host !== "widget") {
      return null;
    }

    if (path === "hydration") {
      return "hydration";
    }

    if (path === "today" || path === "summary") {
      return "today";
    }

    return null;
  } catch {
    return null;
  }
}
