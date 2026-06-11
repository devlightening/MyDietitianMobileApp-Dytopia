import React, { useEffect, useRef, useState } from "react";
import * as SecureStore from "expo-secure-store";

import { useTheme } from "../../context/ThemeContext";
import { useTranslation } from "../../context/I18nContext";
import { useInAppNotifications } from "../../context/InAppNotificationContext";
import { buildBadgeCollection, getToneColor, mapGamificationToMotivation } from "../../motivation/streaks";
import { useGamification } from "../../queries/useGamification";
import { subscribeToGamificationChanges } from "../../utils/gamificationEvents";
import { buildBadgeUnlockedBanner, buildStreakMilestoneBanner } from "../../notifications/notificationEvents";
import BadgeUnlockOverlay, { type BadgeInfo } from "../ui/BadgeUnlockOverlay";
import StreakMilestoneToast, { STREAK_MILESTONES } from "../ui/StreakMilestoneToast";

const SEEN_BADGES_KEY = "celebrated_badge_unlocks_v3";
const SEEN_STREAKS_KEY = "celebrated_streak_milestones_v1";
type QueuedBadgeInfo = BadgeInfo & { celebrationKey: string };

function celebrationKey(badge: ReturnType<typeof buildBadgeCollection>[number]): string {
  if (!badge.isDailyReset) return badge.id;
  const date = badge.unlockedAtUtc ? new Date(badge.unlockedAtUtc).toISOString().slice(0, 10) : "daily";
  return `${badge.id}:${date}`;
}

export default function GlobalCelebrationHost() {
  const { theme } = useTheme();
  const { language } = useTranslation();
  const { notify } = useInAppNotifications();
  const { data, refetch } = useGamification();
  const [activeBadge, setActiveBadge] = useState<QueuedBadgeInfo | null>(null);
  const [queue, setQueue] = useState<QueuedBadgeInfo[]>([]);
  const [activeStreak, setActiveStreak] = useState<number | null>(null);
  const [storageReady, setStorageReady] = useState(false);
  const seenBadges = useRef(new Set<string>());
  const seenStreaks = useRef(new Set<number>());
  const initialized = useRef(false);

  useEffect(() => {
    void Promise.all([
      SecureStore.getItemAsync(SEEN_BADGES_KEY),
      SecureStore.getItemAsync(SEEN_STREAKS_KEY),
    ]).then(([badges, streaks]) => {
      if (badges) (JSON.parse(badges) as string[]).forEach((id) => seenBadges.current.add(id));
      if (streaks) (JSON.parse(streaks) as number[]).forEach((value) => seenStreaks.current.add(value));
      setStorageReady(true);
    }).catch(() => {
      setStorageReady(true);
    });
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = subscribeToGamificationChanges(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void refetch(), 120);
    });
    return () => {
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, [refetch]);

  useEffect(() => {
    if (activeBadge || queue.length === 0) return;
    const [next, ...rest] = queue;
    setActiveBadge(next);
    setQueue(rest);
  }, [activeBadge, queue]);

  useEffect(() => {
    if (!data || !storageReady) return;
    const motivation = mapGamificationToMotivation(data);
    if (!motivation) return;
    const unlocked = buildBadgeCollection(motivation, language).filter((badge) => badge.unlocked);

    if (!initialized.current) {
      const recent = new Set(data.recentUnlocks ?? []);
      const missedRecentBadges = unlocked
        .filter((badge) => recent.has(badge.id) && !seenBadges.current.has(celebrationKey(badge)))
        .map((badge) => ({
          celebrationKey: celebrationKey(badge),
          id: badge.id,
          title: badge.title,
          flavor: badge.flavor,
          icon: badge.icon,
          color: getToneColor(theme, badge.tone),
        }));
      if (missedRecentBadges.length > 0) setQueue(missedRecentBadges);
      unlocked.forEach((badge) => seenBadges.current.add(celebrationKey(badge)));
      STREAK_MILESTONES.filter((value) => value <= (motivation.currentStreak ?? 0))
        .forEach((value) => seenStreaks.current.add(value));
      initialized.current = true;
      void SecureStore.setItemAsync(SEEN_BADGES_KEY, JSON.stringify([...seenBadges.current]));
      return;
    }

    const recent = new Set(data.recentUnlocks ?? []);
    const newBadges = unlocked
      .filter((badge) => !seenBadges.current.has(celebrationKey(badge)))
      .sort((a, b) => Number(!recent.has(a.id)) - Number(!recent.has(b.id)) || b.priority - a.priority);

    if (newBadges.length > 0) {
      const additions = newBadges.map((badge) => ({
        celebrationKey: celebrationKey(badge),
        id: badge.id,
        title: badge.title,
        flavor: badge.flavor,
        icon: badge.icon,
        color: getToneColor(theme, badge.tone),
      }));
      setQueue((current) => {
        const existing = new Set([
          ...current.map((item) => item.celebrationKey),
          ...(activeBadge ? [activeBadge.celebrationKey] : []),
        ]);
        return [...current, ...additions.filter((item) => !existing.has(item.celebrationKey))];
      });
      newBadges.forEach((badge) => {
        seenBadges.current.add(celebrationKey(badge));
        notify(buildBadgeUnlockedBanner(language, badge.title, badge.flavor, badge.id));
      });
      void SecureStore.setItemAsync(SEEN_BADGES_KEY, JSON.stringify([...seenBadges.current]));
      return;
    }

    const streak = motivation.currentStreak ?? 0;
    const milestone = STREAK_MILESTONES.find((value) => value === streak && !seenStreaks.current.has(value));
    if (milestone && !activeBadge && !activeStreak) {
      setActiveStreak(milestone);
      seenStreaks.current.add(milestone);
      notify(buildStreakMilestoneBanner(language, milestone));
      void SecureStore.setItemAsync(SEEN_STREAKS_KEY, JSON.stringify([...seenStreaks.current]));
    }
  }, [activeBadge, activeStreak, data, language, notify, storageReady, theme]);

  return (
    <>
      <StreakMilestoneToast streak={activeStreak} onDismiss={() => setActiveStreak(null)} />
      <BadgeUnlockOverlay badge={activeBadge} onDismiss={() => setActiveBadge(null)} />
    </>
  );
}
