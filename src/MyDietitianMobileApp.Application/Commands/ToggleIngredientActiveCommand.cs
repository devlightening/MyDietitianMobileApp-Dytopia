using MediatR;

namespace MyDietitianMobileApp.Application.Commands
{
    public class ToggleIngredientActiveCommand : IRequest<ToggleIngredientActiveResult>
    {
        public Guid IngredientId { get; }
        public bool IsActive { get; }

        public ToggleIngredientActiveCommand(Guid ingredientId, bool isActive)
        {
            IngredientId = ingredientId;
            IsActive = isActive;
        }
    }

    public class ToggleIngredientActiveResult
    {
        public bool Success { get; }

        public ToggleIngredientActiveResult(bool success)
        {
            Success = success;
        }
    }

    public interface IToggleIngredientActiveHandler
    {
        ToggleIngredientActiveResult Handle(ToggleIngredientActiveCommand command);
    }
}

