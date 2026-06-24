using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using IdentityService.Data;
using IdentityService.Models;
using Microsoft.EntityFrameworkCore;

namespace IdentityService.Controllers
{
    [ApiController]
    [Route("api/auth")]
    public class AuthController : ControllerBase
    {
        private readonly WalletDbContext _context;
        private readonly string _jwtSecret;

        public AuthController(WalletDbContext context, IConfiguration configuration)
        {
            _context = context;
            _jwtSecret = configuration["JWT_SECRET"]
                ?? throw new InvalidOperationException("JWT_SECRET is not configured");
        }

        [HttpPost("login/anonymous")]
        public async Task<IActionResult> AnonymousLogin([FromBody] LoginRequest request)
        {
            var role = string.IsNullOrEmpty(request.Role) ? "LUCY" : request.Role;
            var username = string.IsNullOrEmpty(request.Username)
                ? "User_" + new Random().Next(1000, 9999)
                : request.Username.Trim();

            // Check if user exists
            var user = await _context.Users.FirstOrDefaultAsync(
                u => u.Username.ToLower() == username.ToLower());

            if (user == null)
            {
                user = new User
                {
                    UserId = "user_" + Guid.NewGuid().ToString("n")[..8],
                    Username = username,
                    Role = role
                };
                _context.Users.Add(user);

                var wallet = new Wallet
                {
                    UserId = user.UserId,
                    Coins = 1000
                };
                _context.Wallets.Add(wallet);
                await _context.SaveChangesAsync();
            }

            // Generate real JWT signed with HMAC-SHA256
            var claims = new[]
            {
                new Claim(ClaimTypes.Role,         user.Role),
                new Claim(ClaimTypes.Name,         user.Username),
                new Claim("role",                  user.Role),
                new Claim("name",                  user.Username),
                new Claim("uid",                   user.UserId),
                new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            };

            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwtSecret));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
            var token = new JwtSecurityToken(
                issuer:   "LUCY-Identity",
                audience: "LUCY-Backend",
                claims:   claims,
                expires:  DateTime.UtcNow.AddDays(30),
                signingCredentials: creds
            );

            var tokenString = new JwtSecurityTokenHandler().WriteToken(token);
            return Ok(new { token = tokenString, userId = user.UserId, username = user.Username, role = user.Role });
        }
    }

    public class LoginRequest
    {
        public string DeviceId { get; set; }
        public string? Username { get; set; }
        public string? Role { get; set; }
    }
}
