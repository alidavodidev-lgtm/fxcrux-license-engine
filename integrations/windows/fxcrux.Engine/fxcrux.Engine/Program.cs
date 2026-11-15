using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Pipes;
using System.Net.Http;
using System.Security.AccessControl;
using System.Security.Principal;
using System.Text.Json;
using System.Threading.Tasks;

namespace fxcrux.Engine
{
    internal class Program
    {
        private static string HardwareID = "";

        public static async Task Main()
        {
            Console.WriteLine("FXCrux Secure Engine Starting...");

            // Extract the secure hardware ID immediately upon engine startup
            HardwareID = HardwareScanner.GenerateMachineId();
            Session.MachineId = HardwareID;

            // A secret from a previous session lets the TerminalGateway keep
            // serving trading terminals across an Engine restart without
            // requiring a fresh WPF login every time Windows boots.
            Session.CurrentPairingSecret = SecureStorage.LoadPairingSecret();

            if (Environment.GetEnvironmentVariable("FXCRUX_ENABLE_TRADING_GATEWAY") == "true")
                _ = TerminalGateway.StartAsync(HardwareID);
            _ = HeartbeatLoopAsync();

            await StartSecureNamedPipeServerAsync();
        }

        public static async Task<bool> PerformHardwareLoginAsync(string username, string password)
        {
            if (Environment.GetEnvironmentVariable("FXCRUX_BLOCK_VIRTUAL_MACHINES") == "true" && VmDetector.IsVirtualMachine(out string vmReason))
            {
                Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] SECURITY: refused login on a virtual machine ({vmReason}).");
                Session.LastLoginError = "Virtual machines and VPS environments are not supported by FXCrux.";
                return false;
            }

            string sessionNonce = Guid.NewGuid().ToString("N");

            // Construct the payload with credentials and machine code
            string jsonPayload = $@"{{
                ""username"": ""{username}"",
                ""password"": ""{password}"",
                ""machine_code"": ""{HardwareID}"",
                ""nonce"": ""{sessionNonce}""
            }}";

            // Encrypt the payload using the Hybrid AES+RSA algorithm
            var secureData = SecurityEngine.EncryptData(jsonPayload);
            var requestData = new Dictionary<string, string>
            {
                { "payload", secureData.EncryptedPayload },
                { "key", secureData.EncryptedAesKey },
                { "iv", secureData.AesIV }
            };

            try
            {
                var content = new FormUrlEncodedContent(requestData);

                // Shared, process-lifetime client - see BackendClient.Shared's
                // comment for why a fresh HttpClient per call is a real bug,
                // not just an inefficiency (traced live to intermittent SSL
                // failures under repeated use).
                HttpResponseMessage response = await BackendClient.Shared.PostAsync($"{Constants.BackendBaseUrl}/auth/hardware-login", content);

                if (response.IsSuccessStatusCode)
                {
                    string responseText = await response.Content.ReadAsStringAsync();
                    using JsonDocument serverDoc = JsonDocument.Parse(responseText);

                    string serverEncryptedPayload = serverDoc.RootElement.GetProperty("payload").GetString() ?? "";
                    string serverIv = serverDoc.RootElement.GetProperty("iv").GetString() ?? "";

                    // Decrypt the server's response
                    string decryptedResponse = SecurityEngine.DecryptServerResponse(serverEncryptedPayload, serverIv, secureData.RawAesKey);

                    using JsonDocument finalDoc = JsonDocument.Parse(decryptedResponse);
                    string returnedNonce = finalDoc.RootElement.TryGetProperty("nonce", out var n) ? n.GetString() : "";
                    string status = finalDoc.RootElement.TryGetProperty("status", out var s) ? s.GetString() : "error";

                    // Prevent Replay Attacks
                    if (returnedNonce != sessionNonce)
                    {
                        Console.WriteLine("SECURITY BREACH: Nonce mismatch detected.");
                        Session.LastLoginError = "Security check failed - please try again.";
                        return false;
                    }

                    if (status == "success")
                    {
                        Session.IsAuthenticated = true;
                        Session.Username = username;

                        if (finalDoc.RootElement.TryGetProperty("terminalPairingSecret", out var secretEl))
                        {
                            string? pairingSecret = secretEl.GetString();
                            if (!string.IsNullOrEmpty(pairingSecret))
                            {
                                Session.CurrentPairingSecret = pairingSecret;
                                SecureStorage.SavePairingSecret(pairingSecret);
                            }
                        }

                        Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] Hardware Login: PASSED for user {username}");
                        return true;
                    }

                    Session.LastLoginError = "Invalid credentials or account banned.";
                }
                else
                {
                    Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] Server rejected the request. Status Code: {response.StatusCode}");
                    Session.LastLoginError = "Invalid credentials or account banned.";
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Connection Error: {ex.Message}");
                Session.LastLoginError = "Could not reach the FXCrux server.";
            }

            return false;
        }

        // Refresh active licenses after login. The App Hub uses this list to
        // remove its managed executable downloads when an entitlement ends.
        private static async Task HeartbeatLoopAsync()
        {
            while (true)
            {
                await Task.Delay(TimeSpan.FromSeconds(Constants.HeartbeatIntervalSeconds));

                if (!Session.IsAuthenticated) continue;

                try
                {
                    var state = LocalState.Load();
                    var previouslyTracked = new List<string>(state.Keys);

                    var activeApps = await AppHubService.ListAppsAsync(HardwareID);
                    var stillActive = new HashSet<string>();
                    foreach (var app in activeApps) stillActive.Add(app.Product);

                    foreach (var product in previouslyTracked)
                    {
                        if (!stillActive.Contains(product))
                        {
                            AppHubService.RemoveExpiredExeIfAny(product);
                        }
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[Heartbeat] Tick failed: {ex.Message}");
                }
            }
        }

        static async Task StartSecureNamedPipeServerAsync()
        {
            PipeSecurity pipeSecurity = new PipeSecurity();
            SecurityIdentifier currentUser = WindowsIdentity.GetCurrent().Owner;
            pipeSecurity.AddAccessRule(new PipeAccessRule(currentUser, PipeAccessRights.FullControl, AccessControlType.Allow));

            Console.WriteLine("Core Engine Ready. Waiting for UI connections...");

            while (true)
            {
                try
                {
                    using (NamedPipeServerStream pipeServer = NamedPipeServerStreamAcl.Create(
                        Constants.PipeName, PipeDirection.InOut, NamedPipeServerStream.MaxAllowedServerInstances,
                        PipeTransmissionMode.Message, PipeOptions.Asynchronous, 0, 0, pipeSecurity))
                    {
                        await pipeServer.WaitForConnectionAsync();
                        await HandlePipeSessionAsync(pipeServer);
                    }
                }
                catch (Exception ex) { Console.WriteLine($"Pipe Error: {ex.Message}"); }
            }
        }

        // Protocol v2: a persistent connection carrying newline-delimited JSON
        // commands, one request/response pair at a time (same shape as
        // TerminalGateway's persistent handshake). Replaces the old single-shot
        // "LOGIN|user|pass" line protocol so the UI can issue LIST_APPS/
        // DOWNLOAD/INSTALL/OPEN after login without reconnecting each time.
        // The pipe's ACL (current Windows user only) remains the actual trust
        // boundary here - both ends already run as the same OS user, so this
        // redesign is about structure, not adding a redundant crypto layer on
        // top of a channel that same-user code could inspect via other means
        // (a debugger attached to either process) regardless.
        private static async Task HandlePipeSessionAsync(NamedPipeServerStream pipeServer)
        {
            using StreamReader reader = new StreamReader(pipeServer);
            using StreamWriter writer = new StreamWriter(pipeServer) { AutoFlush = true };

            string? line;
            while (pipeServer.IsConnected && (line = await reader.ReadLineAsync()) != null)
            {
                string responseJson;
                try
                {
                    responseJson = await HandlePipeCommandAsync(line);
                }
                catch (Exception ex)
                {
                    responseJson = SerializeResponse(false, $"Internal error: {ex.Message}");
                }

                try
                {
                    await writer.WriteLineAsync(responseJson);
                }
                catch
                {
                    return; // client disconnected mid-response
                }
            }
        }

        private static async Task<string> HandlePipeCommandAsync(string requestLine)
        {
            using var doc = JsonDocument.Parse(requestLine);
            string cmd = doc.RootElement.TryGetProperty("cmd", out var cmdEl) ? (cmdEl.GetString() ?? "") : "";

            switch (cmd)
            {
                case "LOGIN":
                {
                    string username = doc.RootElement.GetProperty("username").GetString() ?? "";
                    string password = doc.RootElement.GetProperty("password").GetString() ?? "";
                    bool success = await PerformHardwareLoginAsync(username, password);
                    return success
                        ? SerializeResponse(true, "Hardware bound and session active.")
                        : SerializeResponse(false, Session.LastLoginError);
                }

                case "LIST_APPS":
                {
                    if (!Session.IsAuthenticated) return DenyNotAuthenticated();
                    var apps = await AppHubService.ListAppsAsync(HardwareID);
                    var payload = new PipeListAppsResponse
                    {
                        Ok = true,
                        Apps = apps,
                        Username = Session.Username,
                        MachineId = HardwareID,
                        PairingSecret = Session.CurrentPairingSecret,
                    };
                    return JsonSerializer.Serialize(payload, AppJsonContext.Default.PipeListAppsResponse);
                }

                case "DOWNLOAD":
                {
                    if (!Session.IsAuthenticated) return DenyNotAuthenticated();
                    string product = doc.RootElement.GetProperty("product").GetString() ?? "";
                    var (success, message) = await AppHubService.DownloadAsync(HardwareID, product);
                    return SerializeResponse(success, message);
                }

                case "INSTALL":
                {
                    if (!Session.IsAuthenticated) return DenyNotAuthenticated();
                    string product = doc.RootElement.GetProperty("product").GetString() ?? "";
                    List<string>? terminalIds = null;
                    if (doc.RootElement.TryGetProperty("terminalIds", out var idsEl) && idsEl.ValueKind == JsonValueKind.Array)
                    {
                        terminalIds = new List<string>();
                        foreach (var idEl in idsEl.EnumerateArray())
                        {
                            var id = idEl.GetString();
                            if (!string.IsNullOrEmpty(id)) terminalIds.Add(id);
                        }
                    }
                    var response = AppHubService.Install(product, terminalIds);
                    return JsonSerializer.Serialize(response, AppJsonContext.Default.PipeInstallResponse);
                }

                case "OPEN":
                {
                    if (!Session.IsAuthenticated) return DenyNotAuthenticated();
                    string product = doc.RootElement.GetProperty("product").GetString() ?? "";
                    var (success, message) = AppHubService.Open(product);
                    return SerializeResponse(success, message);
                }

                default:
                    return SerializeResponse(false, "Unknown command.");
            }
        }

        private static string SerializeResponse(bool ok, string message) =>
            JsonSerializer.Serialize(new PipeResponse { Ok = ok, Message = message }, AppJsonContext.Default.PipeResponse);

        private static string DenyNotAuthenticated() => SerializeResponse(false, "Please log in first.");
    }
}
