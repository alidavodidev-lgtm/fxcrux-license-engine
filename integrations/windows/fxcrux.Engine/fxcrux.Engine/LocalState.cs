using System;
using System.Collections.Generic;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace fxcrux.Engine
{
    // One MetaTrader broker terminal this product has been installed into.
    // MT4/MT5 commonly have several broker terminals installed side by side
    // (each its own data folder), so - unlike NT8/EXE, which have a single
    // InstallPath - a product can be installed into several of these at once.
    public class TerminalInstall
    {
        [JsonPropertyName("terminalId")] public string TerminalId { get; set; } = "";
        [JsonPropertyName("terminalPath")] public string TerminalPath { get; set; } = "";
        [JsonPropertyName("brokerLabel")] public string BrokerLabel { get; set; } = "";
        [JsonPropertyName("installedVersion")] public string InstalledVersion { get; set; } = "";
    }

    public class AppState
    {
        public string Product { get; set; } = "";
        public string Platform { get; set; } = "";
        public string? DownloadedVersion { get; set; }
        public string? DownloadPath { get; set; }
        // NT8/EXE: single install target.
        public string? InstalledVersion { get; set; }
        public string? InstallPath { get; set; }
        // MT4/MT5 family: one entry per broker terminal the user chose to
        // install into (or that Update later kept in sync).
        public List<TerminalInstall> TerminalInstalls { get; set; } = new();
    }

    // Local manifest of what's been downloaded/installed per product, owned
    // entirely by the Engine. The UI never touches disk or the backend
    // directly - it always asks over the pipe - so this file is the single
    // source of truth behind the Download/Install/Update/Open button state.
    //
    // Per the user's explicit request, the manifest itself lives under the
    // user's Documents folder (not AppData) in a hash-named subfolder rather
    // than something obviously named "FXCrux" - a light obfuscation, not a
    // real security boundary (this data has no secrets in it, just product
    // names/versions/paths - the actual secret, the pairing code, stays in
    // SecureStorage/secure.bin under AppData, a more appropriate place for
    // credential material than a user-visible Documents subfolder). The file
    // content is Base64-encoded rather than plain JSON text for the same
    // "not trivially readable/greppable" reason - again not encryption, just
    // not sitting around as obviously-plain-text.
    internal static class LocalState
    {
        // Downloaded installer files are cache-like binary data, not "the
        // list" the user asked to relocate - they stay under AppData.
        public static readonly string StoreDir =
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "FXCrux");

        private static readonly string ManifestDir =
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments), ComputeManifestFolderName());
        private static readonly string StateFile = Path.Combine(ManifestDir, ComputeManifestFileName());
        private static readonly object Lock = new();

        private static string ComputeManifestFolderName() => "." + ShortHash("FXCrux.AppState.Folder.v1");
        private static string ComputeManifestFileName() => ShortHash("FXCrux.AppState.File.v1") + ".dat";

        private static string ShortHash(string seed)
        {
            byte[] hash = SHA256.HashData(Encoding.UTF8.GetBytes(seed));
            var sb = new StringBuilder();
            foreach (byte b in hash) sb.Append(b.ToString("x2"));
            return sb.ToString(0, 16);
        }

        public static Dictionary<string, AppState> Load()
        {
            lock (Lock)
            {
                try
                {
                    if (!File.Exists(StateFile)) return new Dictionary<string, AppState>();
                    string base64 = File.ReadAllText(StateFile);
                    string json = Encoding.UTF8.GetString(Convert.FromBase64String(base64));
                    return JsonSerializer.Deserialize(json, AppJsonContext.Default.DictionaryStringAppState) ?? new Dictionary<string, AppState>();
                }
                catch
                {
                    return new Dictionary<string, AppState>();
                }
            }
        }

        public static void Save(Dictionary<string, AppState> state)
        {
            lock (Lock)
            {
                try
                {
                    Directory.CreateDirectory(ManifestDir);
                    string json = JsonSerializer.Serialize(state, AppJsonContext.Default.DictionaryStringAppState);
                    string base64 = Convert.ToBase64String(Encoding.UTF8.GetBytes(json));
                    File.WriteAllText(StateFile, base64);
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[LocalState] Failed to persist state: {ex.Message}");
                }
            }
        }

        public static AppState GetOrCreate(Dictionary<string, AppState> state, string product, string platform)
        {
            if (!state.TryGetValue(product, out var appState))
            {
                appState = new AppState { Product = product, Platform = platform };
                state[product] = appState;
            }
            else if (!string.IsNullOrEmpty(platform))
            {
                appState.Platform = platform;
            }
            return appState;
        }
    }
}
