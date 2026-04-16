using MediatR;
using MyDietitianMobileApp.Application.Commands;
using MyDietitianMobileApp.Domain.Repositories;
using MyDietitianMobileApp.Domain.Exceptions;
using MyDietitianMobileApp.Infrastructure.Persistence;
using System.Threading;
using System.Threading.Tasks;

namespace MyDietitianMobileApp.Application.Handlers
{
    public class ToggleIngredientActiveCommandHandler : IToggleIngredientActiveHandler, IRequestHandler<ToggleIngredientActiveCommand, ToggleIngredientActiveResult>
    {
        private readonly IIngredientRepository _ingredientRepository;
        private readonly AppDbContext _context;

        public ToggleIngredientActiveCommandHandler(IIngredientRepository ingredientRepository, AppDbContext context)
        {
            _ingredientRepository = ingredientRepository;
            _context = context;
        }

        public ToggleIngredientActiveResult Handle(ToggleIngredientActiveCommand command)
        {
            var ingredient = _ingredientRepository.GetById(command.IngredientId);
            if (ingredient == null)
            {
                throw new DomainException("INGREDIENT_NOT_FOUND", $"Ingredient {command.IngredientId} not found.");
            }

            ingredient.SetIsActive(command.IsActive);
            _context.SaveChanges();

            return new ToggleIngredientActiveResult(true);
        }

        // MediatR dispatch entry point — delegates to the sync Handle above
        public Task<ToggleIngredientActiveResult> Handle(ToggleIngredientActiveCommand request, CancellationToken cancellationToken)
            => Task.FromResult(Handle(request));
    }
}

