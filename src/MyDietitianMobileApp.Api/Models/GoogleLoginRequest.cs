using System.ComponentModel.DataAnnotations;

namespace MyDietitianMobileApp.Api.Models;

public class GoogleLoginRequest
{
    [Required]
    public string IdToken { get; set; } = string.Empty;
}

