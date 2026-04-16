using MediatR;
using MyDietitianMobileApp.Application.Commands;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Domain.Repositories;
using MyDietitianMobileApp.Domain.Exceptions;
using MyDietitianMobileApp.Infrastructure.Persistence;
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace MyDietitianMobileApp.Application.Handlers
{
    public class CreateIngredientCommandHandler : ICreateIngredientHandler, IRequestHandler<CreateIngredientCommand, CreateIngredientResult>
    {
        private readonly IIngredientRepository _ingredientRepository;
        private readonly AppDbContext _context;

        public CreateIngredientCommandHandler(IIngredientRepository ingredientRepository, AppDbContext context)
        {
            _ingredientRepository = ingredientRepository;
            _context = context;
        }

        public CreateIngredientResult Handle(CreateIngredientCommand command)
        {
            // Check if CanonicalName already exists
            var exists = _ingredientRepository.ExistsByCanonicalName(command.CanonicalName);
            if (exists)
            {
                throw new DomainException("INGREDIENT_ALREADY_EXISTS", $"Ingredient with canonical name '{command.CanonicalName}' already exists.");
            }

            var ingredient = new Ingredient(Guid.NewGuid(), command.CanonicalName.Trim(), command.IsActive);

            // Add aliases
            foreach (var alias in command.Aliases.Where(a => !string.IsNullOrWhiteSpace(a)))
            {
                ingredient.AddAlias(alias.Trim());
            }

            _context.Ingredients.Add(ingredient);
            _context.SaveChanges();

            return new CreateIngredientResult(ingredient.Id);
        }

        // MediatR dispatch entry point — delegates to the sync Handle above
        public Task<CreateIngredientResult> Handle(CreateIngredientCommand request, CancellationToken cancellationToken)
            => Task.FromResult(Handle(request));
    }
}
