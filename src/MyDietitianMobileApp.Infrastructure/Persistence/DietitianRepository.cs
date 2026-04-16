using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Domain.Entities;
using MyDietitianMobileApp.Domain.Repositories;

namespace MyDietitianMobileApp.Infrastructure.Persistence
{
    public class DietitianRepository : IDietitianRepository
    {
        private readonly AppDbContext _context;
        public DietitianRepository(AppDbContext context)
        {
            _context = context;
        }
        public Dietitian? GetById(Guid id)
        {
            return _context.Dietitians
                .Include(d => d.Recipes)
                .Include(d => d.Clients)
                .FirstOrDefault(d => d.Id == id);
        }
    }
}
