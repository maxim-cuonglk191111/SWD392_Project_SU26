using System;
using System.ComponentModel.DataAnnotations;

namespace IdentityService.Models
{
    public class User
    {
        [Key]
        public string UserId { get; set; } = string.Empty;
        public string Username { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

    public class Wallet
    {
        [Key]
        public Guid WalletId { get; set; } = Guid.NewGuid();
        public string UserId { get; set; } = string.Empty;
        public int Coins { get; set; } = 1000; // default 1000 coins
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }

    public class WalletTransaction
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();
        public string FromUserId { get; set; } = string.Empty;
        public string ToUserId { get; set; } = string.Empty;
        public string GiftName { get; set; } = string.Empty;
        public int Coins { get; set; }
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    }

    public class TransferRequest
    {
        public string FromUsername { get; set; } = string.Empty; // using username or user id
        public string ToUsername { get; set; } = string.Empty;
        public string GiftName { get; set; } = string.Empty;
        public int Coins { get; set; }
    }
}
