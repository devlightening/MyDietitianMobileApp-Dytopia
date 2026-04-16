using System;
using System.Collections.Generic;
using System.Linq;
using MediatR;

namespace MyDietitianMobileApp.Application.Commands
{
    public class CreateIngredientCommand : IRequest<CreateIngredientResult>
    {
        public string CanonicalName { get; }
        public IEnumerable<string> Aliases { get; }
        public bool IsActive { get; }

        public CreateIngredientCommand(string canonicalName, IEnumerable<string> aliases, bool isActive = true)
        {
            CanonicalName = canonicalName;
            Aliases = aliases ?? Enumerable.Empty<string>();
            IsActive = isActive;
        }
    }

    public class CreateIngredientResult
    {
        public Guid IngredientId { get; }

        public CreateIngredientResult(Guid ingredientId)
        {
            IngredientId = ingredientId;
        }
    }

    public interface ICreateIngredientHandler
    {
        CreateIngredientResult Handle(CreateIngredientCommand command);
    }
}
