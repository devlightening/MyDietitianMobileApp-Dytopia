using FluentAssertions;
using MyDietitianMobileApp.Infrastructure.Services;
using Xunit;

namespace MyDietitianMobileApp.Api.Tests.Auth;

public class PasswordPolicyTests
{
    [Theory]
    [InlineData("Test1234")]
    [InlineData("Guv3nliSifre")]
    public void Validate_Accepts_BackendRegistrationRule(string password)
    {
        var result = PasswordPolicy.Validate(password);

        result.IsValid.Should().BeTrue();
    }

    [Theory]
    [InlineData("Test12")]
    [InlineData("test1234")]
    [InlineData("TEST1234")]
    [InlineData("Testtest")]
    public void Validate_Rejects_WeakPasswords(string password)
    {
        var result = PasswordPolicy.Validate(password);

        result.IsValid.Should().BeFalse();
        result.ErrorMessage.Should().NotBeNullOrWhiteSpace();
    }
}
