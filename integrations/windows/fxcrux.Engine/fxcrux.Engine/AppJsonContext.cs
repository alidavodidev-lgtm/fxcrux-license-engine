using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace fxcrux.Engine
{
    // Source-generated JSON (de)serialization for every type this Engine
    // sends/persists as JSON - required to keep JsonSerializer reflection-free
    // under a real `dotnet publish -p:PublishAot=true` build.
    [JsonSourceGenerationOptions(DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull)]
    [JsonSerializable(typeof(PipeResponse))]
    [JsonSerializable(typeof(PipeListAppsResponse))]
    [JsonSerializable(typeof(PipeInstallResponse))]
    [JsonSerializable(typeof(InstallRequest))]
    [JsonSerializable(typeof(TerminalDto))]
    [JsonSerializable(typeof(List<TerminalDto>))]
    [JsonSerializable(typeof(GatewayMessage))]
    [JsonSerializable(typeof(PairingSecretPayload))]
    [JsonSerializable(typeof(MachineOnlyRequest))]
    [JsonSerializable(typeof(MachineProductRequest))]
    [JsonSerializable(typeof(AppInfo))]
    [JsonSerializable(typeof(List<AppInfo>))]
    [JsonSerializable(typeof(AppState))]
    [JsonSerializable(typeof(Dictionary<string, AppState>))]
    internal partial class AppJsonContext : JsonSerializerContext
    {
    }
}
