namespace MyDietitianMobileApp.Domain.Entities;

public class ClientRecipeFavorite
{
    public Guid Id { get; private set; }
    public Guid ClientId { get; private set; }
    public Guid RecipeId { get; private set; }
    public bool IsActive { get; private set; }
    public DateTime FirstFavoritedAtUtc { get; private set; }
    public DateTime LastFavoritedAtUtc { get; private set; }
    public DateTime? LastUnfavoritedAtUtc { get; private set; }

    public Client Client { get; private set; } = null!;
    public Recipe Recipe { get; private set; } = null!;

    private ClientRecipeFavorite() { }

    public ClientRecipeFavorite(Guid clientId, Guid recipeId)
    {
        var now = DateTime.UtcNow;
        Id = Guid.NewGuid();
        ClientId = clientId;
        RecipeId = recipeId;
        IsActive = true;
        FirstFavoritedAtUtc = now;
        LastFavoritedAtUtc = now;
    }

    public void Activate()
    {
        IsActive = true;
        LastFavoritedAtUtc = DateTime.UtcNow;
        LastUnfavoritedAtUtc = null;
    }

    public void Deactivate()
    {
        IsActive = false;
        LastUnfavoritedAtUtc = DateTime.UtcNow;
    }
}
