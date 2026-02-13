using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace MyDietitianMobileApp.Application.DTOs
{
    public record DietitianRegisterRequest(
     string FullName,
     string ClinicName,
     string Email,
     string Password
 );
}
