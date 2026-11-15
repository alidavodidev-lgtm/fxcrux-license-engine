using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.Tasks;

namespace fxcrux.Engine
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
        // One of: download, install, installed, update, open - the UI renders
        // the button purely off this field, it never re-derives state itself.
        [JsonPropertyName("buttonState")] public string ButtonState { get; set; } = "download";
    }

    // Orchestrates the Download/Install/Update/Open flow behind the WPF App
    // Hub screen. The UI never talks to the backend or the filesystem
    // directly - every call comes through here over the Named Pipe, which is
    // what keeps the "UI -> Engine -> backend" trust chain intact end to end.
    internal static class AppHubService
    {
        public static async Task<List<AppInfo>> ListAppsAsync(string machineId)
        {
            var result = new List<AppInfo>();
            var listRequest = new MachineOnlyRequest { MachineID = machineId, Timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() };
            var licensesDoc = await BackendClient.PostSecureAsync("/licenses/list-by-machine", listRequest, AppJsonContext.Default.MachineOnlyRequest);

            if (licensesDoc == null || licensesDoc.RootElement.ValueKind != JsonValueKind.Array)
                return result;

            var state = LocalState.Load();

            foreach (var licenseEl in licensesDoc.RootElement.EnumerateArray())
            {
                string product = licenseEl.GetProperty("product").GetString() ?? "";
                if (string.IsNullOrEmpty(product)) continue;

                string? expiresAt = licenseEl.TryGetProperty("expiresAt", out var expEl) ? expEl.GetString() : null;

                var versionDoc = await CheckVersionAsync(machineId, product);
                var root = versionDoc?.RootElement;
                bool hasAccess = root.HasValue && root.Value.TryGetProperty("hasAccess", out var haEl) && haEl.GetBoolean();

                // The user holds an active license for this product, but no
                // ProductVersion has been published for it yet (or none is
                // currently assigned to them) - still show the license, just
                // disabled, rather than silently omitting it from the list.
                // Otherwise a paying customer would see nothing at all and
                // have no way to tell "not licensed" apart from "not shipped yet".
                if (!hasAccess)
                {
                    result.Add(new AppInfo
                    {
                        Product = product,
                        Platform = "",
                        Version = null,
                        ExpiresAt = expiresAt,
                        ButtonState = "unavailable",
                    });
                    continue;
                }

                var rootValue = root!.Value;
                string version = rootValue.GetProperty("version").GetString() ?? "";
                string platform = rootValue.TryGetProperty("platform", out var pEl) ? (pEl.GetString() ?? "") : "";

                var appState = LocalState.GetOrCreate(state, product, platform);

                var info = new AppInfo
                {
                    Product = product,
                    Platform = platform,
                    Version = version,
                    Description = rootValue.TryGetProperty("description", out var dEl) ? dEl.GetString() : null,
                    IconUrl = rootValue.TryGetProperty("iconUrl", out var iEl) ? iEl.GetString() : null,
                    ExpiresAt = expiresAt,
                    DownloadedVersion = appState.DownloadedVersion,
                    InstalledVersion = appState.InstalledVersion,
                };

                info.ButtonState = ComputeButtonState(info, appState);
                result.Add(info);
            }

            LocalState.Save(state);
            return result;
        }

        private static string ComputeButtonState(AppInfo info, AppState appState)
        {
            string platform = PlatformInstaller.Normalize(info.Platform);

            if (string.IsNullOrEmpty(appState.DownloadedVersion))
                return "download";

            if (appState.DownloadedVersion != info.Version)
                return "update";

            if (platform == "exe")
                return "open";

            if (PlatformInstaller.IsMetaTraderFamily(platform))
                return ComputeMetaTraderButtonState(platform, appState);

            if (string.IsNullOrEmpty(appState.InstalledVersion))
                return "install";

            if (appState.InstalledVersion != info.Version)
                return "update";

            return "installed";
        }

        // MT4/MT5: "install" covers any broker terminal that doesn't have this
        // product yet (new install target, needs the user's picker choice);
        // "update" covers terminals that already have it but on an older
        // version (auto-targeted, no picker). If both apply, update wins first
        // since it's the more time-sensitive maintenance action - the user can
        // Install again afterward to pick up any newly-detected terminal.
        private static string ComputeMetaTraderButtonState(string platform, AppState appState)
        {
            var detected = PlatformInstaller.FindTerminals(platform);
            if (detected.Count == 0)
                return appState.TerminalInstalls.Count == 0 ? "install" : "installed";

            var installedIds = new HashSet<string>(appState.TerminalInstalls.Select(t => t.TerminalId));
            bool anyOutdated = appState.TerminalInstalls.Any(t => t.InstalledVersion != appState.DownloadedVersion);
            if (anyOutdated) return "update";

            bool anyUncovered = detected.Any(t => !installedIds.Contains(t.TerminalId));
            if (anyUncovered) return "install";

            return "installed";
        }

        private static async Task<JsonDocument?> CheckVersionAsync(string machineId, string product)
        {
            var request = new MachineProductRequest
            {
                MachineID = machineId,
                ProductName = product,
                Timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
            };
            return await BackendClient.PostSecureAsync("/products/versions/check-by-machine", request, AppJsonContext.Default.MachineProductRequest);
        }

        public static async Task<(bool Success, string Message)> DownloadAsync(string machineId, string product)
        {
            var versionDoc = await CheckVersionAsync(machineId, product);
            // Distinguish "backend unreachable" (versionDoc == null - a network/SSL
            // hiccup, not an access problem) from a genuine "no access" answer -
            // these used to collapse into the same misleading "no longer have
            // access" message, which sent real transient-failure reports down
            // the wrong troubleshooting path.
            if (versionDoc == null)
                return (false, "Could not reach the FXCrux server - check your internet connection and try again.");
            if (!versionDoc.RootElement.TryGetProperty("hasAccess", out var haEl) || !haEl.GetBoolean())
                return (false, "You no longer have access to this product.");

            var root = versionDoc.RootElement;
            string version = root.GetProperty("version").GetString() ?? "";
            string platform = root.TryGetProperty("platform", out var pEl) ? (pEl.GetString() ?? "") : "";
            string? downloadToken = root.TryGetProperty("downloadToken", out var tEl) ? tEl.GetString() : null;

            if (string.IsNullOrEmpty(downloadToken))
                return (false, "Server did not issue a download token.");

            string? tempPath = null;
            try
            {
                var response = await BackendClient.Shared.GetAsync(
                    $"{Constants.BackendBaseUrl}/products/versions/download?token={Uri.EscapeDataString(downloadToken)}");

                if (!response.IsSuccessStatusCode)
                    return (false, $"Download failed (server returned {(int)response.StatusCode}).");

                string fileName = ExtractFileName(response) ?? $"{product}-{version}";
                string targetDir = Path.Combine(LocalState.StoreDir, "Downloads", SanitizeForPath(product), SanitizeForPath(version));
                Directory.CreateDirectory(targetDir);
                string targetPath = Path.Combine(targetDir, fileName);
                long? expectedLength = response.Content.Headers.ContentLength;

                // Download to a temp file first and only move it into place once
                // fully written and length-verified - a half-downloaded file
                // never becomes visible as "the" downloaded file, and never gets
                // recorded in state.json, so a truncated/corrupt download can't
                // silently look like a successful one.
                tempPath = targetPath + ".part";
                long bytesWritten;
                await using (var fileStream = File.Create(tempPath))
                await using (var httpStream = await response.Content.ReadAsStreamAsync())
                {
                    await httpStream.CopyToAsync(fileStream);
                    bytesWritten = fileStream.Length;
                }

                if (expectedLength.HasValue && bytesWritten != expectedLength.Value)
                {
                    File.Delete(tempPath);
                    return (false, $"Download was incomplete ({bytesWritten} of {expectedLength.Value} bytes) - try again.");
                }
                if (bytesWritten == 0)
                {
                    File.Delete(tempPath);
                    return (false, "Downloaded file was empty - try again.");
                }

                if (File.Exists(targetPath)) File.Delete(targetPath);
                File.Move(tempPath, targetPath);
                tempPath = null;

                var state = LocalState.Load();
                var appState = LocalState.GetOrCreate(state, product, platform);
                appState.DownloadedVersion = version;
                appState.DownloadPath = targetPath;
                LocalState.Save(state);

                return (true, $"Downloaded {product} v{version}.");
            }
            catch (Exception ex)
            {
                return (false, $"Download failed: {ex.Message}");
            }
            finally
            {
                if (tempPath != null) { try { File.Delete(tempPath); } catch { } }
            }
        }

        public static PipeInstallResponse Install(string product, List<string>? terminalIds)
        {
            var state = LocalState.Load();
            if (!state.TryGetValue(product, out var appState) || string.IsNullOrEmpty(appState.DownloadPath))
                return new PipeInstallResponse { Ok = false, Message = "Download this app before installing it." };

            string platform = PlatformInstaller.Normalize(appState.Platform);
            string fileName = Path.GetFileName(appState.DownloadPath);

            if (!PlatformInstaller.IsMetaTraderFamily(platform))
            {
                var result = PlatformInstaller.Install(appState.Platform, appState.DownloadPath, fileName);
                if (result.Success)
                {
                    appState.InstalledVersion = appState.DownloadedVersion;
                    appState.InstallPath = result.InstallPath;
                    LocalState.Save(state);
                }
                return new PipeInstallResponse { Ok = result.Success, Message = result.Message };
            }

            return InstallMetaTrader(state, appState, platform, fileName, terminalIds);
        }

        // MT4/MT5: targets terminals that already have this product (an
        // update-in-place, auto-selected) plus whichever terminals the caller
        // explicitly picked (terminalIds, from a prior NeedsSelection round
        // trip). If neither applies and at least one uncovered terminal
        // exists, asks the UI to show a picker instead of guessing.
        private static PipeInstallResponse InstallMetaTrader(
            Dictionary<string, AppState> state, AppState appState, string platform, string fileName, List<string>? terminalIds)
        {
            var detected = PlatformInstaller.FindTerminals(platform);
            if (detected.Count == 0)
                return new PipeInstallResponse { Ok = false, Message = "No matching MetaTrader installation was found on this machine." };

            var alreadyInstalledIds = new HashSet<string>(appState.TerminalInstalls.Select(t => t.TerminalId));
            var targets = detected.Where(t => alreadyInstalledIds.Contains(t.TerminalId)).ToList();

            if (terminalIds != null && terminalIds.Count > 0)
            {
                foreach (var id in terminalIds)
                {
                    var match = detected.FirstOrDefault(t => t.TerminalId == id);
                    if (match != null && !targets.Any(t => t.TerminalId == id)) targets.Add(match);
                }
            }
            else if (targets.Count == 0)
            {
                // Nothing installed yet anywhere and no explicit picks - ask
                // the UI to show a picker rather than choosing on its behalf.
                return new PipeInstallResponse
                {
                    Ok = false,
                    NeedsSelection = true,
                    Message = "Choose which broker terminal(s) to install into.",
                    Terminals = detected.Select(t => new TerminalDto { TerminalId = t.TerminalId, BrokerLabel = t.BrokerLabel }).ToList(),
                };
            }

            var messages = new List<string>();
            bool anySuccess = false;
            foreach (var terminal in targets)
            {
                var result = PlatformInstaller.InstallToTerminal(platform, terminal, appState.DownloadPath!, fileName);
                messages.Add(result.Message);
                if (!result.Success) continue;

                anySuccess = true;
                var existing = appState.TerminalInstalls.FirstOrDefault(t => t.TerminalId == terminal.TerminalId);
                if (existing == null)
                {
                    appState.TerminalInstalls.Add(new TerminalInstall
                    {
                        TerminalId = terminal.TerminalId,
                        TerminalPath = terminal.TerminalPath,
                        BrokerLabel = terminal.BrokerLabel,
                        InstalledVersion = appState.DownloadedVersion ?? "",
                    });
                }
                else
                {
                    existing.InstalledVersion = appState.DownloadedVersion ?? "";
                }
            }

            if (anySuccess) LocalState.Save(state);
            return new PipeInstallResponse { Ok = anySuccess, Message = string.Join(" ", messages) };
        }

        public static (bool Success, string Message) Open(string product)
        {
            var state = LocalState.Load();
            if (!state.TryGetValue(product, out var appState) || string.IsNullOrEmpty(appState.DownloadPath))
                return (false, "Download this app before opening it.");

            if (PlatformInstaller.Normalize(appState.Platform) != "exe")
                return (false, "Open is only available for standalone Windows apps.");

            try
            {
                Process.Start(new ProcessStartInfo(appState.DownloadPath) { UseShellExecute = true });
                return (true, "Launched.");
            }
            catch (Exception ex)
            {
                return (false, $"Could not launch the app: {ex.Message}");
            }
        }

        // Called from the heartbeat loop when a product drops out of the
        // active-license list. Only EXE apps get their local copy deleted -
        // per the product spec, NT8/MT4/MT5 files that were already copied
        // into a third-party terminal's own folders are left alone (deleting
        // a live indicator/EA file out from under a running chart is unsafe
        // and outside what this project controls).
        public static void RemoveExpiredExeIfAny(string product)
        {
            var state = LocalState.Load();
            if (!state.TryGetValue(product, out var appState)) return;
            if (PlatformInstaller.Normalize(appState.Platform) != "exe") return;
            if (string.IsNullOrEmpty(appState.DownloadPath)) return;

            try
            {
                string? dir = Path.GetDirectoryName(appState.DownloadPath);
                if (dir != null && Directory.Exists(dir)) Directory.Delete(dir, recursive: true);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[AppHubService] Failed to clean up expired EXE for {product}: {ex.Message}");
            }

            state.Remove(product);
            LocalState.Save(state);
        }

        private static string? ExtractFileName(HttpResponseMessage response)
        {
            var disposition = response.Content.Headers.ContentDisposition;
            return disposition?.FileNameStar?.Trim('"') ?? disposition?.FileName?.Trim('"');
        }

        private static string SanitizeForPath(string value)
        {
            foreach (var c in Path.GetInvalidFileNameChars()) value = value.Replace(c, '_');
            return value;
        }
    }
}
