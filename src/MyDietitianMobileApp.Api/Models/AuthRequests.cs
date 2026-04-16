using System.ComponentModel.DataAnnotations;

namespace MyDietitianMobileApp.Api.Models
{
    public class RegisterDietitianRequest
    {
        [Required]
        public string FullName { get; set; } = string.Empty;
        [Required]
        public string ClinicName { get; set; } = string.Empty;
        [Required]
        public string Email { get; set; } = string.Empty;
        [Required]
        public string Password { get; set; } = string.Empty;
    }

    public class LoginDietitianRequest
    {
        [Required]
        public string Email { get; set; } = string.Empty;
        [Required]
        public string Password { get; set; } = string.Empty;
    }

    public class LoginClientWithAccessKeyRequest
    {
        [Required]
        public string AccessKey { get; set; } = string.Empty;
    }
}
