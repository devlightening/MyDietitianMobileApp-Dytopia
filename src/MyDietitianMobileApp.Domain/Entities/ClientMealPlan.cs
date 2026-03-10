namespace MyDietitianMobileApp.Domain.Entities;

/// <summary>
/// Represents a meal plan assigned to a client by their dietitian
/// </summary>
public class ClientMealPlan
{
    public Guid Id { get; private set; }
    public Guid ClientId { get; private set; }
    public Guid DietitianId { get; private set; }
    public string Name { get; private set; }
    public string? Description { get; private set; }
    public DateTime StartDate { get; private set; }
    public DateTime? EndDate { get; private set; }
    public bool IsActive { get; private set; }
    public DateTime CreatedAtUtc { get; private set; }
    public DateTime UpdatedAtUtc { get; private set; }

    // Navigation properties
    public Client Client { get; private set; } = null!;
    public Dietitian Dietitian { get; private set; } = null!;
    public ICollection<ClientMeal> Meals { get; private set; } = new List<ClientMeal>();

    // EF Core constructor
    private ClientMealPlan() { }

    public ClientMealPlan(
        Guid clientId,
        Guid dietitianId,
        string name,
        DateTime startDate,
        DateTime? endDate = null,
        string? description = null)
    {
        Id = Guid.NewGuid();
        ClientId = clientId;
        DietitianId = dietitianId;
        Name = name;
        Description = description;
        StartDate = startDate;
        EndDate = endDate;
        IsActive = true;
        CreatedAtUtc = DateTime.UtcNow;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void UpdateDetails(string name, string? description, DateTime startDate, DateTime? endDate)
    {
        Name = name;
        Description = description;
        StartDate = startDate;
        EndDate = endDate;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void Deactivate()
    {
        IsActive = false;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void Reactivate()
    {
        IsActive = true;
        UpdatedAtUtc = DateTime.UtcNow;
    }
}

/// <summary>
/// Represents a single meal within a client's meal plan
/// </summary>
public class ClientMeal
{
    public Guid Id { get; private set; }
    public Guid ClientMealPlanId { get; private set; }
    public Guid RecipeId { get; private set; }
    public int DayOfWeek { get; private set; } // 0 = Sunday, 6 = Saturday
    public string MealType { get; private set; } // breakfast, lunch, dinner, snack
    public int Servings { get; private set; }
    public DateTime? CompletedAt { get; private set; }
    public DateTime CreatedAtUtc { get; private set; }

    // Navigation properties
    public ClientMealPlan ClientMealPlan { get; private set; } = null!;
    public Recipe Recipe { get; private set; } = null!;

    // EF Core constructor
    private ClientMeal() { }

    public ClientMeal(
        Guid clientMealPlanId,
        Guid recipeId,
        int dayOfWeek,
        string mealType,
        int servings = 1)
    {
        if (dayOfWeek < 0 || dayOfWeek > 6)
            throw new ArgumentException("Day of week must be between 0 and 6", nameof(dayOfWeek));

        if (servings <= 0)
            throw new ArgumentException("Servings must be greater than 0", nameof(servings));

        var validMealTypes = new[] { "breakfast", "lunch", "dinner", "snack" };
        if (!validMealTypes.Contains(mealType.ToLower()))
            throw new ArgumentException($"Meal type must be one of: {string.Join(", ", validMealTypes)}", nameof(mealType));

        Id = Guid.NewGuid();
        ClientMealPlanId = clientMealPlanId;
        RecipeId = recipeId;
        DayOfWeek = dayOfWeek;
        MealType = mealType.ToLower();
        Servings = servings;
        CreatedAtUtc = DateTime.UtcNow;
    }

    public void MarkAsCompleted()
    {
        CompletedAt = DateTime.UtcNow;
    }

    public void MarkAsIncomplete()
    {
        CompletedAt = null;
    }
}
