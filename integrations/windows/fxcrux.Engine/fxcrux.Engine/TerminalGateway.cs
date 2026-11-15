using System;
using System.Collections.Concurrent;
using System.Net;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

namespace fxcrux.Engine
{
    // Local-only TCP gateway that lets trading terminals (MT5/NinjaTrader) ask
    // "does this machine have an active license for product X?" without ever
    // handling user credentials themselves - the Engine already knows its own
    // HardwareID and forwards the query to the backend over the existing
    // RSA+AES channel.
    //
    // Authentication uses a per-account pairing secret (see
    // SecureStorage/User.terminal_pairing_secret) instead of a single global
    // constant - a value that used to be baked into every customer's MQL5
    // .mqh file and, once extracted by anyone, let them stand up a fake local
    // "Engine" that always answered active:true for every customer. The
    // secret is only known once the account has logged in at least once (via
    // Program.cs -> SecureStorage), so the gateway simply refuses every
    // handshake until one is available.
    internal static class TerminalGateway
    {
        private class CacheEntry
        {
            public bool Active;
            public DateTime? ExpiresAt;
            public DateTime CachedAt;

            // Raw strings exactly as received from the backend - never
            // reparsed/reformatted. A client verifying the signature must
            // hash the exact bytes the backend signed; round-tripping
            // ExpiresAt through DateTime.Parse(...).ToString("o") silently
            // breaks verification since C#'s "o" format and JS's
            // toISOString() are not guaranteed byte-identical.
            public string? ExpiresAtRaw;
            public string? Signature;
            public string? IssuedAtRaw;
            public string? UserId;
        }

        private static readonly ConcurrentDictionary<string, CacheEntry> _cache = new();
        private static readonly TimeSpan FreshTtl = TimeSpan.FromMinutes(1);
        private static readonly TimeSpan StaleGrace = TimeSpan.FromMinutes(10);

        public static async Task StartAsync(string machineId)
        {
            var listener = new TcpListener(IPAddress.Loopback, Constants.TerminalGatewayPort);
            listener.Start();
            Console.WriteLine($"[TerminalGateway] Listening on 127.0.0.1:{Constants.TerminalGatewayPort}");

            while (true)
            {
                try
                {
                    var client = await listener.AcceptTcpClientAsync();
                    _ = HandleClientAsync(client, machineId);
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[TerminalGateway] Accept error: {ex.Message}");
                }
            }
        }

        private static async Task HandleClientAsync(TcpClient client, string machineId)
        {
            using (client)
            using (var stream = client.GetStream())
            using (var reader = new System.IO.StreamReader(stream, Encoding.UTF8))
            using (var writer = new System.IO.StreamWriter(stream, new UTF8Encoding(false)) { AutoFlush = true })
            {
                try
                {
                    string? pairingSecret = Session.CurrentPairingSecret;
                    if (string.IsNullOrEmpty(pairingSecret))
                    {
                        await WriteMessageAsync(writer, new GatewayMessage { Type = "AUTH_FAILED", Reason = "not_paired" });
                        return;
                    }

                    // 1. Challenge
                    var nonceBytes = RandomNumberGenerator.GetBytes(16);
                    var nonce = Convert.ToHexString(nonceBytes).ToLowerInvariant();
                    await WriteMessageAsync(writer, new GatewayMessage { Type = "CHALLENGE", Nonce = nonce });

                    // 2. Verify response
                    var authLine = await reader.ReadLineAsync();
                    if (authLine == null) return;

                    using var authDoc = JsonDocument.Parse(authLine);
                    var response = authDoc.RootElement.GetProperty("response").GetString() ?? "";
                    var expected = Sha256Hex(nonce + pairingSecret);

                    if (!CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(response.ToLowerInvariant()), Encoding.UTF8.GetBytes(expected)))
                    {
                        await WriteMessageAsync(writer, new GatewayMessage { Type = "AUTH_FAILED" });
                        return;
                    }

                    await WriteMessageAsync(writer, new GatewayMessage { Type = "AUTH_OK" });

                    // 3. Answer CHECK_LICENSE requests for the lifetime of the connection.
                    string? line;
                    while ((line = await reader.ReadLineAsync()) != null)
                    {
                        try
                        {
                            using var doc = JsonDocument.Parse(line);
                            var type = doc.RootElement.GetProperty("type").GetString();
                            if (type != "CHECK_LICENSE") continue;

                            var product = doc.RootElement.GetProperty("product").GetString() ?? "";
                            var result = await CheckLicenseAsync(machineId, product);

                            await WriteMessageAsync(writer, new GatewayMessage
                            {
                                Type = "LICENSE_STATUS",
                                Active = result.Active,
                                Product = product,
                                // Raw strings, relayed unmodified - see CacheEntry's
                                // comment on why these must never be reparsed/reformatted.
                                ExpiresAt = result.ExpiresAtRaw,
                                Signature = result.Signature,
                                IssuedAt = result.IssuedAtRaw,
                                UserId = result.UserId,
                            });
                        }
                        catch (Exception ex)
                        {
                            Console.WriteLine($"[TerminalGateway] Bad request: {ex.Message}");
                        }
                    }
                }
                catch (Exception ex)
                {
                    var socketEx = ex as SocketException ?? ex.InnerException as SocketException;
                    // ConnectionAborted/ConnectionReset here almost always just means a
                    // trading-terminal client gave up mid-handshake and closed its socket
                    // (e.g. it timed out waiting to read the challenge and reconnected) -
                    // normal, expected TCP server behavior, not a real error. Logged at a
                    // quieter level so it doesn't read as alarming; anything else still
                    // prints the full detail since it could be a real protocol/code bug.
                    bool benignAbort = socketEx?.SocketErrorCode is SocketError.ConnectionAborted or SocketError.ConnectionReset;
                    if (benignAbort)
                        Console.WriteLine("[TerminalGateway] A client disconnected mid-handshake (normal if a terminal is still retrying/reconnecting).");
                    else
                        Console.WriteLine($"[TerminalGateway] Connection error: {ex.GetType().Name}: {ex.Message}" +
                            (socketEx != null ? $" (SocketErrorCode={socketEx.SocketErrorCode}={(int)socketEx.SocketErrorCode})" : ""));
                }
            }
        }

        private static Task WriteMessageAsync(System.IO.StreamWriter writer, GatewayMessage message) =>
            writer.WriteLineAsync(JsonSerializer.Serialize(message, AppJsonContext.Default.GatewayMessage));

        private static async Task<(bool Active, DateTime? ExpiresAt, string? ExpiresAtRaw, string? Signature, string? IssuedAtRaw, string? UserId)> CheckLicenseAsync(string machineId, string product)
        {
            if (_cache.TryGetValue(product, out var cached) && DateTime.UtcNow - cached.CachedAt < FreshTtl)
            {
                return (cached.Active, cached.ExpiresAt, cached.ExpiresAtRaw, cached.Signature, cached.IssuedAtRaw, cached.UserId);
            }

            var request = new MachineProductRequest
            {
                MachineID = machineId,
                ProductName = product,
                Timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
            };
            var doc = await BackendClient.PostSecureAsync("/licenses/check-by-machine", request, AppJsonContext.Default.MachineProductRequest);

            if (doc == null) return FallbackToCache(product);

            try
            {
                var active = doc.RootElement.GetProperty("active").GetBoolean();

                // Keep the raw wire strings for anything that ends up inside a
                // signed certificate - reparsing/reformatting them (as the old
                // code did via DateTime.Parse(...).ToString("o")) would silently
                // break signature verification on the client. The parsed
                // DateTime? is kept only for the cache TTL/display purposes.
                string? expiresAtRaw = doc.RootElement.TryGetProperty("expiresAt", out var expEl) && expEl.ValueKind == JsonValueKind.String
                    ? expEl.GetString()
                    : null;
                DateTime? expiresAt = expiresAtRaw != null ? DateTime.Parse(expiresAtRaw).ToUniversalTime() : null;

                string? signature = doc.RootElement.TryGetProperty("signature", out var sigEl) && sigEl.ValueKind == JsonValueKind.String
                    ? sigEl.GetString() : null;
                string? issuedAtRaw = doc.RootElement.TryGetProperty("issuedAt", out var issuedEl) && issuedEl.ValueKind == JsonValueKind.String
                    ? issuedEl.GetString() : null;
                string? userId = doc.RootElement.TryGetProperty("userId", out var userIdEl) && userIdEl.ValueKind == JsonValueKind.String
                    ? userIdEl.GetString() : null;

                _cache[product] = new CacheEntry
                {
                    Active = active,
                    ExpiresAt = expiresAt,
                    CachedAt = DateTime.UtcNow,
                    ExpiresAtRaw = expiresAtRaw,
                    Signature = signature,
                    IssuedAtRaw = issuedAtRaw,
                    UserId = userId,
                };
                return (active, expiresAt, expiresAtRaw, signature, issuedAtRaw, userId);
            }
            catch
            {
                return FallbackToCache(product);
            }
        }

        // Backend unreachable: serve a recent-enough cached answer rather than failing
        // the terminal outright, but never invent a positive answer out of thin air.
        private static (bool Active, DateTime? ExpiresAt, string? ExpiresAtRaw, string? Signature, string? IssuedAtRaw, string? UserId) FallbackToCache(string product)
        {
            if (_cache.TryGetValue(product, out var cached) && DateTime.UtcNow - cached.CachedAt < StaleGrace)
            {
                return (cached.Active, cached.ExpiresAt, cached.ExpiresAtRaw, cached.Signature, cached.IssuedAtRaw, cached.UserId);
            }
            return (false, null, null, null, null, null);
        }

        private static string Sha256Hex(string input)
        {
            var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(input));
            var sb = new StringBuilder();
            foreach (var b in bytes) sb.Append(b.ToString("x2"));
            return sb.ToString();
        }
    }
}
