using System.Collections.Generic;

namespace MyDietitianMobileApp.Domain.Entities
{
    public class Recipe
    {
        public override bool Equals(object obj)
        {
            if (obj is not Recipe other) return false;
            return Id == other.Id;
        }
        public override int GetHashCode() => Id.GetHashCode();
        public Guid Id { get; private set; }
        public Guid? DietitianId { get; private set; } // Nullable for system/public recipes
        public string Name { get; private set; }
        public string Description { get; private set; }
        public bool IsPublic { get; private set; } // Public recipes available to all users
        public IReadOnlyCollection<Ingredient> MandatoryIngredients => _mandatoryIngredients.AsReadOnly();
        public IReadOnlyCollection<Ingredient> OptionalIngredients => _optionalIngredients.AsReadOnly();
        public IReadOnlyCollection<Ingredient> ProhibitedIngredients => _prohibitedIngredients.AsReadOnly();

        private readonly List<Ingredient> _mandatoryIngredients = new();
        private readonly List<Ingredient> _optionalIngredients = new();
        private readonly List<Ingredient> _prohibitedIngredients = new();

        // EF Core constructor
        private Recipe() { }

        public Recipe(Guid id, Guid? dietitianId, string name, string description, bool isPublic = false)
        {
            Id = id;
            DietitianId = dietitianId;
            Name = name;
            Description = description;
            IsPublic = isPublic;
        }

        public void AddMandatoryIngredient(Ingredient ingredient)
        {
            if (_mandatoryIngredients.Any(i => i.Id == ingredient.Id))
                return;
            _mandatoryIngredients.Add(ingredient);
        }

        public void AddOptionalIngredient(Ingredient ingredient)
        {
            if (_optionalIngredients.Any(i => i.Id == ingredient.Id))
                return;
            _optionalIngredients.Add(ingredient);
        }

        public void AddProhibitedIngredient(Ingredient ingredient)
        {
            if (_prohibitedIngredients.Any(i => i.Id == ingredient.Id))
                return;
            _prohibitedIngredients.Add(ingredient);
        }

        public void UpdateName(string name)
        {
            if (string.IsNullOrWhiteSpace(name))
                throw new ArgumentException("Recipe name cannot be null or empty", nameof(name));
            Name = name.Trim();
        }

        public void UpdateDescription(string description)
        {
            Description = description?.Trim() ?? string.Empty;
        }

        public void ClearMandatoryIngredients()
        {
            _mandatoryIngredients.Clear();
        }

        public void ClearOptionalIngredients()
        {
            _optionalIngredients.Clear();
        }

        public void ClearProhibitedIngredients()
        {
            _prohibitedIngredients.Clear();
        }

        public void ClearSubstitutes()
        {
            // Note: Substitutes are managed via RecipeIngredientSubstitute join table
            // This method is a placeholder for domain API consistency
        }

        public void SetSubstitutes(Guid requiredIngredientId, IEnumerable<Guid> substituteIngredientIds)
        {
            // Validation: requiredIngredientId must be in MandatoryIngredients
            if (!_mandatoryIngredients.Any(i => i.Id == requiredIngredientId))
            {
                throw new InvalidOperationException($"Required ingredient {requiredIngredientId} must be in MandatoryIngredients");
            }

            // Validation: substitutes cannot be in ProhibitedIngredients
            var prohibitedIds = _prohibitedIngredients.Select(i => i.Id).ToHashSet();
            var invalidSubstitutes = substituteIngredientIds.Where(id => prohibitedIds.Contains(id)).ToList();
            if (invalidSubstitutes.Any())
            {
                throw new InvalidOperationException($"Substitute ingredients cannot be in ProhibitedIngredients: {string.Join(", ", invalidSubstitutes)}");
            }

            // Note: Actual persistence is handled by EF Core via RecipeIngredientSubstitute join table
            // This method is a placeholder for domain API consistency
        }
    }
}
