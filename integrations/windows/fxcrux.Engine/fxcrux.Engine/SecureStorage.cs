using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace fxcrux.Engine
{
    // DPAPI-protected local persistence, current-Windows-user scope only.
    // Holds the per-account TerminalGateway pairing secret (mirrors the
    // backend's User.terminal_pairing_secret) so it survives Engine restarts
    // without ever being a compile-time constant shipped to every customer.
    internal static class SecureStorage
    {
        private static readonly string StoreDir =
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "FXCrux");
        private static readonly string StoreFile = Path.Combine(StoreDir, "secure.bin");

        public static string? LoadPairingSecret()
        {
            try
            {
                if (!File.Exists(StoreFile)) return null;
                byte[] protectedBytes = File.ReadAllBytes(StoreFile);
                byte[] plainBytes = ProtectedData.Unprotect(protectedBytes, null, DataProtectionScope.CurrentUser);
                var payload = JsonSerializer.Deserialize(Encoding.UTF8.GetString(plainBytes), AppJsonContext.Default.PairingSecretPayload);
                return payload?.TerminalPairingSecret;
            }
            catch
            {
                // Corrupt/foreign-user file, or nothing saved yet - callers treat
                // null the same as "no secret available, TerminalGateway stays closed".
                return null;
            }
        }

        public static void SavePairingSecret(string secret)
        {
            try
            {
                Directory.CreateDirectory(StoreDir);
                var payload = new PairingSecretPayload { TerminalPairingSecret = secret };
                byte[] plainBytes = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(payload, AppJsonContext.Default.PairingSecretPayload));
                byte[] protectedBytes = ProtectedData.Protect(plainBytes, null, DataProtectionScope.CurrentUser);
                File.WriteAllBytes(StoreFile, protectedBytes);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[SecureStorage] Failed to persist pairing secret: {ex.Message}");
            }
        }
    }
}
