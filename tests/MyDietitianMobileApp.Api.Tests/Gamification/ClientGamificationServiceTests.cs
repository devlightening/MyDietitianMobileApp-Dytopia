using System;
using System.Linq;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Application.Services;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Infrastructure.Persistence;
using Xunit;

namespace MyDietitianMobileApp.Api.Tests.Gamification;

public class ClientGamificationServiceTests
{
    [Fact]
    public async Task GetSummaryAsync_UnlocksFlexSaver_ForAlternativeCompletedMeals()
    {
        await using var db = CreateDbContext();

        var clientId = Guid.NewGuid();
        var dietitianId = Guid.NewGuid();
        var today = DateTime.UtcNow.Date;

        var plan = new MealPlan
        {
            Id = Guid.NewGuid(),
            ClientId = clientId,
            Date = today,
            Status = MealPlanStatus.Published,
            CreatedBy = dietitianId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        var breakfast = new PlanMealItem
        {
            Id = Guid.NewGuid(),
            PlanId = plan.Id,
            Plan = plan,
            Time = TimeSpan.FromHours(9),
            MealType = PlanMealItemType.Breakfast,
            Title = "Avokadolu kahvalti tabagi",
            OrderIndex = 0,
            CreatedAt = DateTime.UtcNow
        };

        var lunch = new PlanMealItem
        {
            Id = Guid.NewGuid(),
            PlanId = plan.Id,
            Plan = plan,
            Time = TimeSpan.FromHours(13),
            MealType = PlanMealItemType.Lunch,
            Title = "Sebzeli wrap",
            OrderIndex = 1,
            CreatedAt = DateTime.UtcNow
        };

        plan.Items = [breakfast, lunch];

        db.MealPlans.Add(plan);
        db.PlanMealItems.AddRange(breakfast, lunch);
        db.MealCompletions.AddRange(
            new MealCompletion(clientId, dietitianId, breakfast.Id, MealCompletionStatus.Alternative, alternativeRecipeId: Guid.NewGuid()),
            new MealCompletion(clientId, dietitianId, lunch.Id, MealCompletionStatus.Alternative, alternativeRecipeId: Guid.NewGuid()));

        await db.SaveChangesAsync();

        var service = new ClientGamificationService(db);

        var summary = await service.GetSummaryAsync(clientId, isPremium: true, dietitianId);

        summary.Today.AlternativeMeals.Should().Be(2);
        summary.Today.DoneMeals.Should().Be(0);
        summary.Today.PerfectDay.Should().BeTrue();
        summary.Achievements.Single(x => x.Id == "flex_saver").Unlocked.Should().BeTrue();
        summary.Achievements.Single(x => x.Id == "perfect_day").Unlocked.Should().BeTrue();
    }

    [Fact]
    public async Task TrackEventAsync_UnlocksGameMonster_AfterThreeDifferentDailyGames()
    {
        await using var db = CreateDbContext();

        var clientId = Guid.NewGuid();
        var dietitianId = Guid.NewGuid();
        var service = new ClientGamificationService(db);

        await service.TrackEventAsync(clientId, isPremium: true, dietitianId, ClientGamificationService.EventTypes.GameCompleted, new { gameType = "memory" });
        await service.TrackEventAsync(clientId, isPremium: true, dietitianId, ClientGamificationService.EventTypes.GameCompleted, new { gameType = "quiz" });
        await service.TrackEventAsync(clientId, isPremium: true, dietitianId, ClientGamificationService.EventTypes.GameCompleted, new { gameType = "word" });

        var summary = await service.GetSummaryAsync(clientId, isPremium: true, dietitianId);

        var gameMonster = summary.Achievements.Single(x => x.Id == "game_monster");
        gameMonster.ProgressCurrent.Should().Be(3);
        gameMonster.Unlocked.Should().BeTrue();
        db.ClientAchievementUnlocks.Count(x => x.ClientId == clientId && x.BadgeId == "game_monster").Should().Be(1);
    }

    [Fact]
    public async Task TrackEventAsync_KeepsGameMonsterLocked_BeforeThreeDailyGames()
    {
        await using var db = CreateDbContext();

        var clientId = Guid.NewGuid();
        var dietitianId = Guid.NewGuid();
        var service = new ClientGamificationService(db);

        await service.TrackEventAsync(clientId, isPremium: true, dietitianId, ClientGamificationService.EventTypes.GameCompleted, new { gameType = "memory" });
        await service.TrackEventAsync(clientId, isPremium: true, dietitianId, ClientGamificationService.EventTypes.GameCompleted, new { gameType = "quiz" });

        var summary = await service.GetSummaryAsync(clientId, isPremium: true, dietitianId);

        var gameMonster = summary.Achievements.Single(x => x.Id == "game_monster");
        gameMonster.ProgressCurrent.Should().Be(2);
        gameMonster.Unlocked.Should().BeFalse();
    }

    private static AppDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options;

        return new AppDbContext(options);
    }
}
