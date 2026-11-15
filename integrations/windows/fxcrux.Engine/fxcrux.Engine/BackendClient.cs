using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Text.Json;
using System.Text.Json.Serialization.Metadata;
using System.Threading.Tasks;

namespace fxcrux.Engine
{
    // Shared helper for the machine-id-authenticated RSA+AES envelope calls the
    // Engine makes to the backend (licenses/check-by-machine, licenses/list-by-machine,
    // products/versions/check-by-machine) - all three send an encrypted request and
    // get back plain, unencrypted JSON (see RsaHybridService usage on the backend;
    // only /auth/hardware-login encrypts its response, handled separately in Program.cs
    // since it also needs the raw AES key to decrypt). Centralizes what was previously
    // duplicated between Program.cs and TerminalGateway.cs.
    internal static class BackendClient
    {
        // A single shared, process-lifetime HttpClient - NOT a fresh instance
        // per call. `using HttpClient http = new HttpClient()` per request is
        // a well-known .NET anti-pattern: each instance opens its own socket
        // pool and TLS session cache, and disposing it right after one request
        // doesn't release the underlying TCP connection immediately (it sits
        // in TIME_WAIT). Over a long-running Engine process making many
        // requests (every App Hub refresh calls this once per licensed
        // product), that adds up to real socket/port pressure, and was traced
        // live to intermittent "SSL connection could not be established"
        // failures during actual testing - reusing one HttpClient for the
        // process's lifetime is the standard fix.
        public static readonly HttpClient Shared = new HttpClient();

        public static async Task<JsonDocument?> PostSecureAsync<T>(string path, T payload, JsonTypeInfo<T> jsonTypeInfo)
        {
            try
            {
                var jsonPayload = JsonSerializer.Serialize(payload, jsonTypeInfo);
                var secureData = SecurityEngine.EncryptData(jsonPayload);

                var body = new Dictionary<string, string>
                {
                    { "payload", secureData.EncryptedPayload },
                    { "key", secureData.EncryptedAesKey },
                    { "iv", secureData.AesIV },
                };

                var response = await Shared.PostAsync($"{Constants.BackendBaseUrl}{path}", new FormUrlEncodedContent(body));
                if (!response.IsSuccessStatusCode) return null;

                var responseText = await response.Content.ReadAsStringAsync();
                return JsonDocument.Parse(responseText);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[BackendClient] {path} failed: {ex.Message}");
                return null;
            }
        }
    }
}
