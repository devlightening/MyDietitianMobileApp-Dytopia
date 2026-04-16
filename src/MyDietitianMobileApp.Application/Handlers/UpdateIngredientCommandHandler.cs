using MediatR;
using MyDietitianMobileApp.Application.Commands;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Domain.Repositories;
using MyDietitianMobileApp.Domain.Exceptions;
using MyDietitianMobileApp.Infrastructure.Persistence;
using System.Threading;
using System.Threading.Tasks;

namespace MyDietitianMobileApp.Application.Handlers
{
    public class UpdateIngredientCommandHandler : IUpdateIngredientHandler, IRequestHandler<UpdateIngredientCommand, UpdateIngredientResult>
    {
        private readonly IIngredientRepository _ingredientRepository;
        private readonly AppDbContext _context;

        public UpdateIngredientCommandHandler(IIngredientRepository ingredientRepository, AppDbContext context)
        {
            _ingredientRepository = ingredientRepository;
            _context = context;
        }

        public UpdateIngredientResult Handle(UpdateIngredientCommand command)
        {
            var ingredient = _ingredientRepository.GetById(command.IngredientId);
            if (ingredient == null)
            {
                throw new DomainException("INGREDIENT_NOT_FOUND", $"Ingredient {command.IngredientId} not found.");
            }

            // Check if CanonicalName already exists (excluding current ingredient)
            var exists = _ingredientRepository.ExistsByCanonicalName(command.CanonicalName, command.IngredientId);
            if (exists)
            {
                throw new DomainException("INGREDIENT_ALREADY_EXISTS", $"Ingredient with canonical name '{command.CanonicalName}' already exists.");
            }

            // Update properties
            ingredient.UpdateCanonicalName(command.CanonicalName);
            ingredient.SetIsActive(command.IsActive);

            // Update aliases
            ingredient.ClearAliases();
            foreach (var alias in command.Aliases.Where(a => !string.IsNullOrWhiteSpace(a)))
            {
                ingredient.AddAlias(alias.Trim());
            }

            _context.SaveChanges();

            return new UpdateIngredientResult(true);
        }

        // MediatR dispatch entry point — delegates to the sync Handle above
        public Task<UpdateIngredientResult> Handle(UpdateIngredientCommand request, CancellationToken cancellationToken)
            => Task.FromResult(Handle(request));
    }
}

