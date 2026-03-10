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
        string? createdAtUtc = null;
        string? expiresAtUtc = null;

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
                case "createdatutc":
                case "startdate": // backward compatibility
                    createdAtUtc = reader.GetString();
                    break;
                case "expiresatutc":
                case "enddate": // backward compatibility
                    expiresAtUtc = reader.GetString();
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

        if (createdAtUtc is null || expiresAtUtc is null)
            throw new JsonException("createdAtUtc and expiresAtUtc are required.");

        return new CreateAccessKeyRequest(effectivePublicUserId, createdAtUtc, expiresAtUtc);
    }

    public override void Write(Utf8JsonWriter writer, CreateAccessKeyRequest value, JsonSerializerOptions options)
    {
        writer.WriteStartObject();
        writer.WriteString("publicUserId", value.PublicUserId);
        writer.WriteString("createdAtUtc", value.CreatedAtUtc);
        writer.WriteString("expiresAtUtc", value.ExpiresAtUtc);
        writer.WriteEndObject();
    }
}
