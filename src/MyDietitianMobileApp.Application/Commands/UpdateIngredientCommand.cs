using MediatR;

namespace MyDietitianMobileApp.Application.Commands
{
    public class UpdateIngredientCommand : IRequest<UpdateIngredientResult>
    {
        public Guid IngredientId { get; }
        public string CanonicalName { get; }
        public IEnumerable<string> Aliases { get; }
        public bool IsActive { get; }

        public UpdateIngredientCommand(
            Guid ingredientId,
            string canonicalName,
            IEnumerable<string> aliases,
            bool isActive)
        {
            IngredientId = ingredientId;
            CanonicalName = canonicalName;
            Aliases = aliases ?? Enumerable.Empty<string>();
            IsActive = isActive;
        }
    }

    public class UpdateIngredientResult
    {
        public bool Success { get; }

        public UpdateIngredientResult(bool success)
        {
            Success = success;
        }
    }

    public interface IUpdateIngredientHandler
    {
        UpdateIngredientResult Handle(UpdateIngredientCommand command);
    }
}

