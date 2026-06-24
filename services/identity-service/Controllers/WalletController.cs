using Microsoft.AspNetCore.Mvc;
using IdentityService.Data;
using IdentityService.Models;
using Microsoft.EntityFrameworkCore;

namespace IdentityService.Controllers
{
    [ApiController]
    [Route("api/wallet")]
    public class WalletController : ControllerBase
    {
        private readonly WalletDbContext _context;

        public WalletController(WalletDbContext context)
        {
            _context = context;
        }

        [HttpGet("{userId}/balance")]
        public async Task<IActionResult> GetBalance(string userId)
        {
            var wallet = await _context.Wallets.FirstOrDefaultAsync(w => w.UserId == userId);
            if (wallet == null)
            {
                // Fallback for custom/unregistered user IDs (e.g. host_mentor)
                var user = await _context.Users.FirstOrDefaultAsync(u => u.UserId == userId);
                if (user != null)
                {
                    wallet = new Wallet { UserId = userId, Coins = 1000 };
                    _context.Wallets.Add(wallet);
                    await _context.SaveChangesAsync();
                }
                else
                {
                    return NotFound(new { error = "Wallet not found for this user." });
                }
            }
            return Ok(new { balance = wallet.Coins });
        }

        [HttpPost("transfer")]
        public async Task<IActionResult> TransferCoins([FromBody] TransferRequest request)
        {
            if (request == null || request.Coins <= 0)
            {
                return BadRequest(new { error = "Invalid transfer request parameters." });
            }

            // Find sender
            var sender = await _context.Users.FirstOrDefaultAsync(u => u.Username.ToLower() == request.FromUsername.ToLower());
            if (sender == null)
            {
                return NotFound(new { error = $"Sender '{request.FromUsername}' not found." });
            }

            // Find or create receiver (e.g. Host Mentor)
            var receiver = await _context.Users.FirstOrDefaultAsync(u => u.Username.ToLower() == request.ToUsername.ToLower());
            if (receiver == null)
            {
                // If it is Host Mentor, let's create them on the fly if they don't exist (in case DB seed is reset)
                if (request.ToUsername.ToLower() == "host mentor")
                {
                    receiver = new User { UserId = "host_mentor", Username = "Host Mentor", Role = "LUCY Pro" };
                    _context.Users.Add(receiver);
                    await _context.SaveChangesAsync();
                }
                else
                {
                    return NotFound(new { error = $"Receiver '{request.ToUsername}' not found." });
                }
            }

            // Get wallets
            var senderWallet = await _context.Wallets.FirstOrDefaultAsync(w => w.UserId == sender.UserId);
            if (senderWallet == null)
            {
                senderWallet = new Wallet { UserId = sender.UserId, Coins = 1000 };
                _context.Wallets.Add(senderWallet);
            }

            var receiverWallet = await _context.Wallets.FirstOrDefaultAsync(w => w.UserId == receiver.UserId);
            if (receiverWallet == null)
            {
                receiverWallet = new Wallet { UserId = receiver.UserId, Coins = 1000 };
                _context.Wallets.Add(receiverWallet);
            }

            // Check balance
            if (senderWallet.Coins < request.Coins)
            {
                return BadRequest(new { error = $"Insufficient balance. You have {senderWallet.Coins} coins, but gift cost is {request.Coins}." });
            }

            // Perform transaction
            senderWallet.Coins -= request.Coins;
            receiverWallet.Coins += request.Coins;

            var transaction = new WalletTransaction
            {
                FromUserId = sender.UserId,
                ToUserId = receiver.UserId,
                GiftName = request.GiftName,
                Coins = request.Coins
            };
            _context.WalletTransactions.Add(transaction);

            await _context.SaveChangesAsync();

            return Ok(new 
            { 
                success = true, 
                senderBalance = senderWallet.Coins,
                receiverBalance = receiverWallet.Coins,
                message = $"Successfully transferred {request.Coins} coins for {request.GiftName}."
            });
        }
    }
}
