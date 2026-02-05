namespace MyDietitianMobileApp.Application.DTOs;

/// <summary>
/// Request to create a new meal plan
/// </summary>
public class CreateMealPlanRequest
{
    public DateTime Date { get; set; }
}

/// <summary>
/// Request to bulk upsert meal items in a plan
/// </summary>
public class BulkUpsertMealItemsRequest
{
    public List<UpsertMealItemDTO> Items { get; set; } = new();
}

/// <summary>
/// DTO for upserting a meal item (create or update)
/// </summary>
public class UpsertMealItemDTO
{
    public Guid? Id { get; set; } // null for new items
    public string Time { get; set; } = string.Empty; // HH:mm format
    public string Title { get; set; } = string.Empty;
    public string? Note { get; set; }
    public int OrderIndex { get; set; }
    public int? Calories { get; set; }
    public MacrosDTO? Macros { get; set; }
}

/// <summary>
/// Request to duplicate a meal plan to another date
/// </summary>
public class DuplicatePlanRequest
{
    public DateTime ToDate { get; set; }
}
