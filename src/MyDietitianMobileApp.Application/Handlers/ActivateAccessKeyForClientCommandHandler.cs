using MyDietitianMobileApp.Application.Commands;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Domain.Repositories;
using System;
using System.Linq;

namespace MyDietitianMobileApp.Application.Handlers
{
    public class ActivateAccessKeyForClientCommandHandler : IActivateAccessKeyForClientHandler
    {
        private readonly IClientRepository _clientRepository;
        public ActivateAccessKeyForClientCommandHandler(IClientRepository clientRepository)
        {
            _clientRepository = clientRepository;
        }
        public ActivateAccessKeyForClientResult Handle(ActivateAccessKeyForClientCommand command)
        {
            var client = _clientRepository.GetById(command.ClientId);
            if (client == null || !client.IsActive)
                throw new InvalidOperationException("Client not found or inactive.");
            var toActivate = client.AccessKeys.FirstOrDefault(k => k.Id == command.AccessKeyId);
            if (toActivate == null)
                throw new InvalidOperationException("AccessKey not found for client.");
            foreach (var key in client.AccessKeys.Where(k => k.DietitianId == toActivate.DietitianId && k.IsActive && k.Id != toActivate.Id))
                key.Deactivate();
            if (!toActivate.IsActive)
                toActivate = new AccessKey(toActivate.Id, toActivate.KeyValue, toActivate.DietitianId, toActivate.ClientId, toActivate.CreatedAtUtc, toActivate.ExpiresAtUtc, true);
            // Domain: enforce only one active key (already enforced in AddAccessKey)
            return new ActivateAccessKeyForClientResult(true);
        }
    }
}
