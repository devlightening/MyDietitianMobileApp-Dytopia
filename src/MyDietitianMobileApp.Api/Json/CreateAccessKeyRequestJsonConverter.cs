using System.Text.Json;
using System.Text.Json.Serialization;
using MyDietitianMobileApp.Api.Controllers;

namespace MyDietitianMobileApp.Api.Json;

public class CreateAccessKeyRequestJsonConverter : JsonConverter<CreateAccessKeyRequest>
{
    public override CreateAccessKeyRequest Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        if (reader.TokenType != JsonTokenType.StartObject)
        {
            throw new JsonException("Expected JSON object for CreateAccessKeyRequest.");
        }

        string? publicUserId = null;
        string? clientIdLegacy = null;
        string? startDate = null;
        string? endDate = null;

        while (reader.Read())
        {
            if (reader.TokenType == JsonTokenType.EndObject)
                break;

            if (reader.TokenType != JsonTokenType.PropertyName)
                continue;

            var propName = reader.GetString();
            reader.Read();

            switch (propName?.ToLowerInvariant())
            {
                case "publicuserid":
                    publicUserId = reader.GetString();
                    break;
                case "clientid":
                    clientIdLegacy = reader.GetString();
                    break;
                case "startdate":
                    startDate = reader.GetString();
                    break;
                case "enddate":
                    endDate = reader.GetString();
                    break;
                default:
                    reader.Skip();
                    break;
            }
        }

        // Backward compatibility: if publicUserId missing, use clientId
        var effectivePublicUserId = !string.IsNullOrWhiteSpace(publicUserId)
            ? publicUserId!
            : clientIdLegacy ?? string.Empty;

        if (string.IsNullOrWhiteSpace(effectivePublicUserId))
            throw new JsonException("publicUserId is required.");

        if (startDate is null || endDate is null)
            throw new JsonException("startDate and endDate are required.");

        return new CreateAccessKeyRequest(effectivePublicUserId, startDate, endDate);
    }

    public override void Write(Utf8JsonWriter writer, CreateAccessKeyRequest value, JsonSerializerOptions options)
    {
        writer.WriteStartObject();
        writer.WriteString("publicUserId", value.PublicUserId);
        writer.WriteString("startDate", value.StartDate);
        writer.WriteString("endDate", value.EndDate);
        writer.WriteEndObject();
    }
}

