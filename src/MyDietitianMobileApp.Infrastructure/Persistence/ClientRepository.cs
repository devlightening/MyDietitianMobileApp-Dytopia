using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Domain.Repositories;

namespace MyDietitianMobileApp.Infrastructure.Persistence
{
    public class ClientRepository : IClientRepository
    {
        private readonly AppDbContext _context;
        public ClientRepository(AppDbContext context)
        {
            _context = context;
        }
        public Client? GetById(Guid id)
        {
            return _context.Clients
                .Include(c => c.AccessKeys)
                .FirstOrDefault(c => c.Id == id);
        }
    }
}
