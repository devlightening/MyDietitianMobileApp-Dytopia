using Microsoft.EntityFrameworkCore;
using MyDietitianMobileApp.Domain.Entities;
using System;
using System.Linq;

namespace MyDietitianMobileApp.Infrastructure.Persistence
{
    public class AccessKeyRepository
    {
        private readonly AppDbContext _context;
        public AccessKeyRepository(AppDbContext context)
        {
            _context = context;
        }
        public AccessKey? GetById(Guid id)
        {
            return _context.AccessKeys.FirstOrDefault(a => a.Id == id);
        }
        public IQueryable<AccessKey> GetByDietitianId(Guid dietitianId)
        {
            return _context.AccessKeys.Where(a => a.DietitianId == dietitianId);
        }
    }
}
