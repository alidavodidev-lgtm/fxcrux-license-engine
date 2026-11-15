using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace fxcrux.Engine
{
    // Wire types for the UI<->Engine Named Pipe (protocol v2) and the
    // Engine<->trading-terminal TerminalGateway handshake. Named (not
    // anonymous) so System.Text.Json's source generator (AppJsonContext) can
    // (de)serialize them without reflection - anonymous-object
    // JsonSerializer.Serialize calls are not AOT/trim-safe (see the IL2026/
    // IL3050 warnings a plain `dotnet build` already surfaces even before
    // publishing) and this project's whole point is a real Native AOT binary.

    public class PipeResponse
    {
        [JsonPropertyName("ok")] public bool Ok { get; set; }
        [JsonPropertyName("message")] public string Message { get; set; } = "";
    }

    public class PipeListAppsResponse
    {
        [JsonPropertyName("ok")] public bool Ok { get; set; }
        [JsonPropertyName("apps")] public List<AppInfo> Apps { get; set; } = new();
        [JsonPropertyName("username")] public string Username { get; set; } = "";
        [JsonPropertyName("machineId")] public string MachineId { get; set; } = "";
        [JsonPropertyName("pairingSecret")] public string? PairingSecret { get; set; }
    }

    public class GatewayMessage
    {
        [JsonPropertyName("type")] public string Type { get; set; } = "";
        [JsonPropertyName("reason")] public string? Reason { get; set; }
        [JsonPropertyName("nonce")] public string? Nonce { get; set; }
        [JsonPropertyName("active")] public bool? Active { get; set; }
        [JsonPropertyName("product")] public string? Product { get; set; }
        [JsonPropertyName("expiresAt")] public string? ExpiresAt { get; set; }
        // Relayed unmodified from the backend's signed license certificate -
        // the Engine does not verify these itself, it's a pure pass-through.
        // The trading-terminal client (e.g. FxCruxLicense.cs) is the one that
        // verifies the signature using the deployment's public key and the
        // certificate's issued time, user, product, and expiration.
        [JsonPropertyName("signature")] public string? Signature { get; set; }
        [JsonPropertyName("issuedAt")] public string? IssuedAt { get; set; }
        [JsonPropertyName("userId")] public string? UserId { get; set; }
    }

    public class PairingSecretPayload
    {
        [JsonPropertyName("terminalPairingSecret")] public string? TerminalPairingSecret { get; set; }
    }

    public class MachineOnlyRequest
    {
        [JsonPropertyName("MachineID")] public string MachineID { get; set; } = "";
        [JsonPropertyName("Timestamp")] public long Timestamp { get; set; }
    }

    public class MachineProductRequest
    {
        [JsonPropertyName("MachineID")] public string MachineID { get; set; } = "";
        [JsonPropertyName("ProductName")] public string ProductName { get; set; } = "";
        [JsonPropertyName("Timestamp")] public long Timestamp { get; set; }
    }

    // MT4/MT5 install: a first-time install needs the user to pick which
    // detected broker terminal(s) to install into (terminalIds omitted/empty
    // on the first call -> Engine replies with PipeInstallResponse.NeedsSelection
    // + the candidate list instead of installing); an update auto-targets
    // whatever terminals already have this product, no picker needed.
    public class InstallRequest
    {
        [JsonPropertyName("cmd")] public string Cmd { get; set; } = "INSTALL";
        [JsonPropertyName("product")] public string Product { get; set; } = "";
        [JsonPropertyName("terminalIds")] public List<string>? TerminalIds { get; set; }
    }

    public class TerminalDto
    {
        [JsonPropertyName("terminalId")] public string TerminalId { get; set; } = "";
        [JsonPropertyName("brokerLabel")] public string BrokerLabel { get; set; } = "";
    }

    public class PipeInstallResponse
    {
        [JsonPropertyName("ok")] public bool Ok { get; set; }
        [JsonPropertyName("message")] public string Message { get; set; } = "";
        [JsonPropertyName("needsSelection")] public bool NeedsSelection { get; set; }
        [JsonPropertyName("terminals")] public List<TerminalDto> Terminals { get; set; } = new();
    }
}
