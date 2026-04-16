using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Application.DTOs;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Infrastructure.Persistence;

namespace MyDietitianMobileApp.Application.Services;

public class ClientGamificationService : IClientGamificationService
{
    public static class EventTypes
    {
        public const string AppOpen = "app_open";
        public const string KitchenRecipeGenerated = "kitchen_recipe_generated";
        public const string MealDone = "meal_done";
        public const string MealAlternative = "meal_alternative";
        public const string MealSkipped = "meal_skipped";
        public const string WaterGoalHit = "water_goal_hit";
        public const string MeasurementLogged = "measurement_logged";
        public const string CareMessageSent = "care_message_sent";
    }

    private static readonly HashSet<string> SinglePerDayEvents =
    [
        EventTypes.AppOpen,
        EventTypes.KitchenRecipeGenerated,
        EventTypes.WaterGoalHit,
        EventTypes.MeasurementLogged,
        EventTypes.CareMessageSent
    ];

    private static readonly string[] VegetableKeywords =
    [
        "sebze", "salata", "brokoli", "karnabahar", "kabak", "ispanak", "ıspanak",
        "domates", "salatalik", "salatalık", "biber", "roka", "marul", "lahana",
        "havuc", "havuç", "avokado", "cucumber", "tomato", "spinach", "broccoli",
        "pepper", "lettuce", "salad", "vegetable", "carrot", "zucchini"
    ];

    private readonly AppDbContext _appDb;

    public ClientGamificationService(AppDbContext appDb)
    {
        _appDb = appDb;
    }

    public async Task<ClientGamificationSummaryDTO> GetSummaryAsync(
        Guid clientId,
        bool isPremium,
        Guid? dietitianId,
        CancellationToken ct = default)
    {
        return await BuildStateAsync(clientId, isPremium, dietitianId, persistChanges: true, ct);
    }

    public async Task TrackEventAsync(
        Guid clientId,
        bool isPremium,
        Guid? dietitianId,
        string eventType,
        object? metadata = null,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(eventType))
            return;

        var normalizedEventType = eventType.Trim();
        var nowUtc = DateTime.UtcNow;
        var eventDate = DateOnly.FromDateTime(nowUtc);

        if (SinglePerDayEvents.Contains(normalizedEventType))
        {
            var exists = await _appDb.ClientEngagementEvents.AnyAsync(
                x => x.ClientId == clientId &&
                     x.EventType == normalizedEventType &&
                     x.EventDate == eventDate,
                ct);

            if (!exists)
            {
                _appDb.ClientEngagementEvents.Add(
                    new ClientEngagementEvent(clientId, dietitianId, normalizedEventType, nowUtc, metadata));
            }
        }
        else
        {
            _appDb.ClientEngagementEvents.Add(
                new ClientEngagementEvent(clientId, dietitianId, normalizedEventType, nowUtc, metadata));
        }

        await BuildStateAsync(clientId, isPremium, dietitianId, persistChanges: true, ct);
    }

    public async Task<DietitianGamificationSummaryDTO> GetDietitianSummaryAsync(
        Guid dietitianId,
        int limit = 8,
        CancellationToken ct = default)
    {
        var linkedClients = await _appDb.DietitianClientLinks
            .AsNoTracking()
            .Where(x => x.DietitianId == dietitianId && x.IsActive)
            .Select(x => x.ClientId)
            .Distinct()
            .ToListAsync(ct);

        if (linkedClients.Count == 0)
            return new DietitianGamificationSummaryDTO();

        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        var clients = await _appDb.Clients
            .AsNoTracking()
            .Where(x => linkedClients.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, x => x.FullName ?? "Danisan", ct);

        var snapshots = await _appDb.ClientGamificationSnapshots
            .AsNoTracking()
            .Where(x => linkedClients.Contains(x.ClientId) && x.Date == today)
            .ToListAsync(ct);

        var unlocks = await _appDb.ClientAchievementUnlocks
            .AsNoTracking()
            .Where(x => linkedClients.Contains(x.ClientId))
            .ToListAsync(ct);

        var recentRiskIds = await _appDb.ClientActivities
            .AsNoTracking()
            .Where(x =>
                linkedClients.Contains(x.ClientId) &&
                x.Type == "streak_at_risk" &&
                x.AtUtc >= DateTime.UtcNow.Date)
            .Select(x => x.ClientId)
            .Distinct()
            .ToListAsync(ct);

        var riskSet = recentRiskIds.ToHashSet();
        var unlockGroups = unlocks.GroupBy(x => x.ClientId).ToDictionary(x => x.Key, x => x.OrderByDescending(v => v.UnlockedAtUtc).ToList());
        var snapshotMap = snapshots.ToDictionary(x => x.ClientId, x => x);

        var pulses = linkedClients
            .Select(clientId =>
            {
                snapshotMap.TryGetValue(clientId, out var snapshot);
                unlockGroups.TryGetValue(clientId, out var clientUnlocks);
                clientUnlocks ??= [];

                return new ClientMotivationPulseDTO
                {
                    ClientId = clientId,
                    ClientName = clients.GetValueOrDefault(clientId, "Danisan"),
                    CurrentStreak = snapshot?.CurrentStreak ?? 0,
                    BestStreak = snapshot?.BestStreak ?? 0,
                    StreakAtRisk = riskSet.Contains(clientId),
                    EarnedBadgeCount = clientUnlocks.Count,
                    PrimaryTrack = snapshot?.PrimaryTrack ?? "daily_rhythm",
                    RecentBadgeIds = clientUnlocks.Take(3).Select(x => x.BadgeId).ToList(),
                    LastUnlockAtUtc = clientUnlocks.FirstOrDefault()?.UnlockedAtUtc
                };
            })
            .OrderByDescending(x => x.StreakAtRisk)
            .ThenByDescending(x => x.LastUnlockAtUtc)
            .ThenByDescending(x => x.CurrentStreak)
            .Take(Math.Clamp(limit, 1, 24))
            .ToList();

        return new DietitianGamificationSummaryDTO
        {
            ClientsAtRiskCount = pulses.Count(x => x.StreakAtRisk),
            NewUnlocksCount = unlocks.Count(x => x.UnlockedAtUtc >= DateTime.UtcNow.AddDays(-7)),
            ActiveStreaksCount = pulses.Count(x => x.CurrentStreak > 0),
            Clients = pulses
        };
    }

    private async Task<ClientGamificationSummaryDTO> BuildStateAsync(
        Guid clientId,
        bool isPremium,
        Guid? dietitianId,
        bool persistChanges,
        CancellationToken ct)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var startDate = today.AddDays(-44);
        var startUtc = startDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);

        var plans = await _appDb.MealPlans
            .AsNoTracking()
            .Where(x =>
                x.ClientId == clientId &&
                x.Status == MealPlanStatus.Published &&
                x.Date >= startUtc &&
                x.Date < today.AddDays(1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc))
            .Include(x => x.Items)
            .ToListAsync(ct);

        var planItems = plans
            .SelectMany(plan => plan.Items.Select(item => new { Date = DateOnly.FromDateTime(plan.Date), Item = item }))
            .ToList();

        var mealItemIds = planItems.Select(x => x.Item.Id).ToList();

        var completions = mealItemIds.Count == 0
            ? []
            : await _appDb.MealCompletions
                .AsNoTracking()
                .Where(x => x.ClientId == clientId && mealItemIds.Contains(x.DietPlanMealId))
                .ToListAsync(ct);

        var tracking = await _appDb.ClientDailyTrackings
            .AsNoTracking()
            .Where(x => x.ClientId == clientId && x.Date >= startDate && x.Date <= today)
            .ToListAsync(ct);

        var measurements = await _appDb.ClientMeasurementEntries
            .AsNoTracking()
            .Where(x => x.ClientId == clientId && x.AtUtc >= startUtc)
            .ToListAsync(ct);

        var careMessages = await _appDb.ClientCareMessages
            .AsNoTracking()
            .Where(x => x.ClientId == clientId && x.SenderRole == "Client" && x.CreatedAtUtc >= startUtc)
            .ToListAsync(ct);

        var events = await _appDb.ClientEngagementEvents
            .Where(x => x.ClientId == clientId && x.EventDate >= startDate && x.EventDate <= today)
            .ToListAsync(ct);

        var unlocks = await _appDb.ClientAchievementUnlocks
            .Where(x => x.ClientId == clientId)
            .ToDictionaryAsync(x => x.BadgeId, StringComparer.OrdinalIgnoreCase, ct);

        var snapshots = await _appDb.ClientGamificationSnapshots
            .Where(x => x.ClientId == clientId && x.Date >= startDate && x.Date <= today)
            .ToDictionaryAsync(x => x.Date, ct);

        var completionsByMealId = completions
            .GroupBy(x => x.DietPlanMealId)
            .ToDictionary(x => x.Key, x => x.OrderByDescending(v => v.AtUtc).First());

        var planItemsByDate = planItems
            .GroupBy(x => x.Date)
            .ToDictionary(x => x.Key, x => x.Select(v => v.Item).ToList());

        var trackingByDate = tracking.ToDictionary(x => x.Date, x => x);
        var eventsByDate = events.GroupBy(x => x.EventDate).ToDictionary(x => x.Key, x => x.ToList());
        var measurementDates = measurements.Select(x => DateOnly.FromDateTime(x.AtUtc)).ToHashSet();
        var careMessageDates = careMessages.Select(x => DateOnly.FromDateTime(x.CreatedAtUtc)).ToHashSet();

        var dayStates = new List<DayState>();
        var runningStreak = 0;
        var bestStreak = 0;

        for (var cursor = startDate; cursor <= today; cursor = cursor.AddDays(1))
        {
            planItemsByDate.TryGetValue(cursor, out var items);
            items ??= [];

            var plannedMeals = items.Count;
            var doneMeals = 0;
            var alternativeMeals = 0;
            var skippedMeals = 0;
            decimal proteinTotal = 0;
            var vegetableSignals = 0;

            foreach (var item in items)
            {
                completionsByMealId.TryGetValue(item.Id, out var completion);

                switch (completion?.Status)
                {
                    case MealCompletionStatus.Done:
                        doneMeals++;
                        proteinTotal += item.ProteinGrams ?? 0;
                        if (HasVegetableSignal(item))
                            vegetableSignals++;
                        break;
                    case MealCompletionStatus.Alternative:
                        alternativeMeals++;
                        proteinTotal += item.ProteinGrams ?? 0;
                        if (HasVegetableSignal(item))
                            vegetableSignals++;
                        break;
                    case MealCompletionStatus.Skipped:
                        skippedMeals++;
                        break;
                }
            }

            var adherenceScore = plannedMeals > 0
                ? Math.Min(1m, (doneMeals + (alternativeMeals * 0.7m)) / plannedMeals)
                : 0m;

            trackingByDate.TryGetValue(cursor, out var dailyTracking);
            eventsByDate.TryGetValue(cursor, out var dayEvents);
            dayEvents ??= [];

            var kitchenEvents = dayEvents.Count(x => x.EventType == EventTypes.KitchenRecipeGenerated);
            var appOpenEvents = dayEvents.Count(x => x.EventType == EventTypes.AppOpen);
            var waterGoalHit = (dailyTracking?.WaterGlasses ?? 0) >= 8;
            var measurementLogged = measurementDates.Contains(cursor);
            var careMessageSent = careMessageDates.Contains(cursor);
            var engagementScore = BuildEngagementScore(kitchenEvents, appOpenEvents, waterGoalHit, measurementLogged, careMessageSent, doneMeals + alternativeMeals);
            var primaryTrack = isPremium && plannedMeals > 0 ? "plan_adherence" : "daily_rhythm";
            var qualifiedForStreak = primaryTrack == "plan_adherence"
                ? adherenceScore >= 0.8m
                : kitchenEvents > 0 || (appOpenEvents > 0 && (waterGoalHit || measurementLogged || careMessageSent || doneMeals + alternativeMeals > 0));

            runningStreak = qualifiedForStreak ? runningStreak + 1 : 0;
            bestStreak = Math.Max(bestStreak, runningStreak);

            dayStates.Add(new DayState(
                cursor,
                primaryTrack,
                primaryTrack == "plan_adherence" ? adherenceScore : engagementScore,
                adherenceScore,
                engagementScore,
                qualifiedForStreak,
                runningStreak,
                bestStreak,
                plannedMeals,
                doneMeals,
                alternativeMeals,
                skippedMeals,
                dailyTracking?.WaterGlasses ?? 0,
                waterGoalHit,
                kitchenEvents,
                measurementLogged,
                careMessageSent,
                proteinTotal,
                vegetableSignals));
        }

        var todayState = dayStates.Last();
        var yesterdayState = dayStates.Count > 1 ? dayStates[^2] : null;
        var currentStreak = todayState.QualifiedForStreak ? todayState.CurrentStreak : yesterdayState?.CurrentStreak ?? 0;
        var streakAtRisk = !todayState.QualifiedForStreak && currentStreak > 0;
        var atRiskReason = streakAtRisk
            ? todayState.PrimaryTrack == "plan_adherence"
                ? "Bugunku plan uyumu seriyi korumak icin yeterli degil."
                : "Bugun ritmi koruyacak bir etkileşim henuz yok."
            : null;

        var anyPerfectDay = dayStates.Any(x => x.PlannedMeals > 0 && x.DoneMeals == x.PlannedMeals);
        var anyFlexSaver = dayStates.Any(x => x.PlannedMeals > 0 && x.AlternativeMeals > 0 && x.AdherenceScore >= 0.8m);
        var daysWithKitchen = dayStates.Count(x => x.KitchenEvents > 0);
        var daysWithWaterGoal = dayStates.Count(x => x.WaterGoalHit);
        var weeklyQualifiedDays = dayStates.TakeLast(7).Count(x => x.QualifiedForStreak);

        var achievements = new List<GamificationAchievementDTO>
        {
            CreateAchievement("streak_3", currentStreak, 3, unlocks),
            CreateAchievement("streak_7", currentStreak, 7, unlocks),
            CreateAchievement("streak_14", currentStreak, 14, unlocks),
            CreateAchievement("perfect_day", anyPerfectDay ? 1 : 0, 1, unlocks),
            CreateAchievement("protein_focus", (int)Math.Round(Math.Min(todayState.ProteinTotal, 70m)), 70, unlocks),
            CreateAchievement("veggie_focus", Math.Min(todayState.VegetableSignals, 3), 3, unlocks),
            CreateAchievement("kitchen_spark", Math.Min(daysWithKitchen, 5), 5, unlocks),
            CreateAchievement("water_keeper", Math.Min(daysWithWaterGoal, 3), 3, unlocks),
            CreateAchievement("flex_saver", anyFlexSaver ? 1 : 0, 1, unlocks),
            CreateAchievement("plan_keeper", Math.Min(weeklyQualifiedDays, 5), 5, unlocks)
        };

        var newlyUnlocked = new List<string>();
        foreach (var achievement in achievements.Where(x => x.Unlocked))
        {
            if (unlocks.ContainsKey(achievement.Id))
                continue;

            var unlock = new ClientAchievementUnlock(clientId, achievement.Id);
            _appDb.ClientAchievementUnlocks.Add(unlock);
            unlocks[achievement.Id] = unlock;
            newlyUnlocked.Add(achievement.Id);

            _appDb.ClientActivities.Add(new ClientActivity(
                clientId,
                dietitianId,
                "badge_unlocked",
                new { badgeId = achievement.Id, currentStreak }));

            if (achievement.Id.StartsWith("streak_", StringComparison.Ordinal))
            {
                _appDb.ClientActivities.Add(new ClientActivity(
                    clientId,
                    dietitianId,
                    "streak_milestone",
                    new { badgeId = achievement.Id, currentStreak }));
            }
        }

        if (streakAtRisk)
        {
            var riskLogged = await _appDb.ClientActivities.AnyAsync(
                x =>
                    x.ClientId == clientId &&
                    x.Type == "streak_at_risk" &&
                    x.AtUtc >= DateTime.UtcNow.Date,
                ct);

            if (!riskLogged)
            {
                _appDb.ClientActivities.Add(new ClientActivity(
                    clientId,
                    dietitianId,
                    "streak_at_risk",
                    new { currentStreak, todayState.PrimaryTrack }));
            }
        }

        foreach (var state in dayStates)
        {
            if (!snapshots.TryGetValue(state.Date, out var snapshot))
            {
                snapshot = new ClientGamificationSnapshot(clientId, state.Date);
                _appDb.ClientGamificationSnapshots.Add(snapshot);
                snapshots[state.Date] = snapshot;
            }

            snapshot.Update(
                state.PrimaryTrack,
                state.PrimaryScore,
                state.AdherenceScore,
                state.EngagementScore,
                state.QualifiedForStreak,
                state.CurrentStreak,
                state.BestStreak,
                state.PlannedMeals,
                state.DoneMeals,
                state.AlternativeMeals,
                state.SkippedMeals,
                state.WaterGlasses,
                state.WaterGoalHit,
                state.KitchenEvents,
                state.MeasurementLogged,
                state.CareMessageSent);
        }

        if (persistChanges)
            await _appDb.SaveChangesAsync(ct);

        var recentUnlocks = unlocks.Values
            .OrderByDescending(x => x.UnlockedAtUtc)
            .Take(4)
            .Select(x => x.BadgeId)
            .ToList();

        foreach (var badgeId in newlyUnlocked)
        {
            if (!recentUnlocks.Contains(badgeId, StringComparer.OrdinalIgnoreCase))
                recentUnlocks.Add(badgeId);
        }

        return new ClientGamificationSummaryDTO
        {
            PrimaryTrack = todayState.PrimaryTrack,
            CurrentStreak = currentStreak,
            BestStreak = dayStates.Max(x => x.BestStreak),
            EarnedBadgeCount = achievements.Count(x => x.Unlocked),
            TotalBadgeCount = achievements.Count,
            NextMilestoneDays = GetNextMilestoneDays(currentStreak),
            StreakAtRisk = streakAtRisk,
            AtRiskReason = atRiskReason,
            Today = new GamificationTodayDTO
            {
                PrimaryScore = todayState.PrimaryScore,
                AdherenceScore = todayState.AdherenceScore,
                EngagementScore = todayState.EngagementScore,
                QualifiedForStreak = todayState.QualifiedForStreak,
                PerfectDay = todayState.PlannedMeals > 0 && todayState.DoneMeals == todayState.PlannedMeals,
                PlannedMeals = todayState.PlannedMeals,
                DoneMeals = todayState.DoneMeals,
                AlternativeMeals = todayState.AlternativeMeals,
                SkippedMeals = todayState.SkippedMeals,
                WaterGlasses = todayState.WaterGlasses,
                WaterGoalHit = todayState.WaterGoalHit,
                KitchenEvents = todayState.KitchenEvents,
                MeasurementLogged = todayState.MeasurementLogged,
                CareMessageSent = todayState.CareMessageSent
            },
            Achievements = achievements,
            RecentUnlocks = recentUnlocks
        };
    }

    private static GamificationAchievementDTO CreateAchievement(
        string id,
        int progressCurrent,
        int progressTarget,
        IReadOnlyDictionary<string, ClientAchievementUnlock> unlocks)
    {
        unlocks.TryGetValue(id, out var unlock);
        return new GamificationAchievementDTO
        {
            Id = id,
            ProgressCurrent = Math.Min(progressCurrent, progressTarget),
            ProgressTarget = progressTarget,
            Unlocked = unlock != null || progressCurrent >= progressTarget,
            UnlockedAtUtc = unlock?.UnlockedAtUtc
        };
    }

    private static decimal BuildEngagementScore(
        int kitchenEvents,
        int appOpenEvents,
        bool waterGoalHit,
        bool measurementLogged,
        bool careMessageSent,
        int completedMeals)
    {
        var score = 0m;
        score += Math.Min(0.45m, kitchenEvents * 0.35m);
        score += Math.Min(0.1m, appOpenEvents * 0.05m);
        score += waterGoalHit ? 0.15m : 0m;
        score += measurementLogged ? 0.15m : 0m;
        score += careMessageSent ? 0.1m : 0m;
        score += completedMeals > 0 ? 0.15m : 0m;
        return Math.Min(1m, score);
    }

    private static bool HasVegetableSignal(PlanMealItem item)
    {
        var haystack = $"{item.Title} {item.Note}".ToLowerInvariant();
        return VegetableKeywords.Any(haystack.Contains);
    }

    private static int GetNextMilestoneDays(int currentStreak)
    {
        foreach (var milestone in new[] { 3, 7, 14 })
        {
            if (currentStreak < milestone)
                return milestone - currentStreak;
        }

        return 0;
    }

    private sealed record DayState(
        DateOnly Date,
        string PrimaryTrack,
        decimal PrimaryScore,
        decimal AdherenceScore,
        decimal EngagementScore,
        bool QualifiedForStreak,
        int CurrentStreak,
        int BestStreak,
        int PlannedMeals,
        int DoneMeals,
        int AlternativeMeals,
        int SkippedMeals,
        int WaterGlasses,
        bool WaterGoalHit,
        int KitchenEvents,
        bool MeasurementLogged,
        bool CareMessageSent,
        decimal ProteinTotal,
        int VegetableSignals);
}
