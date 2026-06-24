using Microsoft.EntityFrameworkCore;
using IdentityService.Models;

namespace IdentityService.Data
{
    public class WalletDbContext : DbContext
    {
        public WalletDbContext(DbContextOptions<WalletDbContext> options) : base(options)
        {
        }

        public DbSet<User> Users { get; set; }
        public DbSet<Wallet> Wallets { get; set; }
        public DbSet<WalletTransaction> WalletTransactions { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);
            
            // Seed a default Host user so they can receive coins
            modelBuilder.Entity<User>().HasData(
                new User { UserId = "host_mentor", Username = "Host Mentor", Role = "LUCY Pro" }
            );
            
            modelBuilder.Entity<Wallet>().HasData(
                new Wallet { WalletId = Guid.Parse("11111111-1111-1111-1111-111111111111"), UserId = "host_mentor", Coins = 5000 }
            );
        }
    }
}
