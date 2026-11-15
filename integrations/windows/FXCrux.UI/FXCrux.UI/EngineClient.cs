using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Pipes;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.Json.Serialization.Metadata;
using System.Threading;
using System.Threading.Tasks;

namespace FXCrux.UI
{
    public class AppInfo
    {
        [JsonPropertyName("product")] public string Product { get; set; } = "";
        [JsonPropertyName("platform")] public string Platform { get; set; } = "";
        [JsonPropertyName("version")] public string? Version { get; set; }
        [JsonPropertyName("description")] public string? Description { get; set; }
        [JsonPropertyName("iconUrl")] public string? IconUrl { get; set; }
        [JsonPropertyName("expiresAt")] public string? ExpiresAt { get; set; }
        [JsonPropertyName("downloadedVersion")] public string? DownloadedVersion { get; set; }
        [JsonPropertyName("installedVersion")] public string? InstalledVersion { get; set; }
        [JsonPropertyName("buttonState")] public string ButtonState { get; set; } = "download";
    }

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

    public class InstallRequest
    {
        [JsonPropertyName("cmd")] public string Cmd { get; set; } = "INSTALL";
        [JsonPropertyName("product")] public string Product { get; set; } = "";
        [JsonPropertyName("terminalIds")] public List<string>? TerminalIds { get; set; }
    }

    [JsonSourceGenerationOptions(DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull)]
    [JsonSerializable(typeof(PipeResponse))]
    [JsonSerializable(typeof(PipeListAppsResponse))]
    [JsonSerializable(typeof(PipeInstallResponse))]
    [JsonSerializable(typeof(InstallRequest))]
    [JsonSerializable(typeof(Dictionary<string, string>))]
    internal partial class UiJsonContext : JsonSerializerContext
    {
    }

    // Thin client for the Engine's Named Pipe protocol v2 (persistent
    // connection, newline-delimited JSON commands, one request/response pair
    // at a time - see Program.cs on the Engine side). Kept open for the
    // lifetime of the app after a successful login so LIST_APPS/DOWNLOAD/
    // INSTALL/OPEN don't each need a fresh handshake.
    public class EngineClient : IAsyncDisposable
    {
        private NamedPipeClientStream? _pipe;
        private StreamReader? _reader;
        private StreamWriter? _writer;
        private readonly SemaphoreSlim _lock = new(1, 1);

        public async Task ConnectAsync(int timeoutMs = 3000)
        {
            _pipe = new NamedPipeClientStream(".", "FXCrux_Core_Secure_Pipe", PipeDirection.InOut, PipeOptions.Asynchronous);
            await _pipe.ConnectAsync(timeoutMs);
            _reader = new StreamReader(_pipe);
            _writer = new StreamWriter(_pipe) { AutoFlush = true };
        }

        public async Task<PipeResponse> LoginAsync(string username, string password)
        {
            var request = new Dictionary<string, string> { { "cmd", "LOGIN" }, { "username", username }, { "password", password } };
            return await SendAsync(request, UiJsonContext.Default.DictionaryStringString, UiJsonContext.Default.PipeResponse);
        }

        public async Task<PipeListAppsResponse> ListAppsAsync()
        {
            var request = new Dictionary<string, string> { { "cmd", "LIST_APPS" } };
            return await SendAsync(request, UiJsonContext.Default.DictionaryStringString, UiJsonContext.Default.PipeListAppsResponse);
        }

        public Task<PipeResponse> DownloadAsync(string product) => SendProductCommandAsync("DOWNLOAD", product);
        public Task<PipeResponse> OpenAsync(string product) => SendProductCommandAsync("OPEN", product);

        public Task<PipeInstallResponse> InstallAsync(string product, List<string>? terminalIds = null)
        {
            var request = new InstallRequest { Product = product, TerminalIds = terminalIds };
            return SendAsync(request, UiJsonContext.Default.InstallRequest, UiJsonContext.Default.PipeInstallResponse);
        }

        private Task<PipeResponse> SendProductCommandAsync(string cmd, string product)
        {
            var request = new Dictionary<string, string> { { "cmd", cmd }, { "product", product } };
            return SendAsync(request, UiJsonContext.Default.DictionaryStringString, UiJsonContext.Default.PipeResponse);
        }

        private async Task<TResponse> SendAsync<TRequest, TResponse>(
            TRequest request, JsonTypeInfo<TRequest> requestTypeInfo, JsonTypeInfo<TResponse> responseTypeInfo)
            where TResponse : new()
        {
            if (_pipe == null || _reader == null || _writer == null || !_pipe.IsConnected)
                throw new InvalidOperationException("Not connected to the Engine.");

            await _lock.WaitAsync();
            try
            {
                string requestJson = JsonSerializer.Serialize(request, requestTypeInfo);
                await _writer.WriteLineAsync(requestJson);

                string? responseLine = await _reader.ReadLineAsync();
                if (responseLine == null)
                    throw new IOException("Engine closed the connection.");

                return JsonSerializer.Deserialize(responseLine, responseTypeInfo) ?? new TResponse();
            }
            finally
            {
                _lock.Release();
            }
        }

        public async ValueTask DisposeAsync()
        {
            _reader?.Dispose();
            _writer?.Dispose();
            if (_pipe != null) await _pipe.DisposeAsync();
        }
    }
}
