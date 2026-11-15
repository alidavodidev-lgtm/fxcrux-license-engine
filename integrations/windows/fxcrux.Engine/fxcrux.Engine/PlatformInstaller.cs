using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text;

namespace fxcrux.Engine
{
    public class InstallResult
    {
        public bool Success { get; }
        public string Message { get; }
        public string? InstallPath { get; }

        private InstallResult(bool success, string message, string? installPath)
        {
            Success = success;
            Message = message;
            InstallPath = installPath;
        }

        public static InstallResult Ok(string message, string? installPath = null) => new(true, message, installPath);
        public static InstallResult Fail(string message) => new(false, message, null);
    }

    public class TerminalInfo
    {
        public string TerminalId { get; set; } = "";
        public string TerminalPath { get; set; } = "";
        public string BrokerLabel { get; set; } = "";
    }

    // Platform-aware install dispatch. Accepted platform labels (free text
    // from ProductVersion.platform - see product-version.entity.ts, no
    // server-side whitelist, normalization happens here on the client):
    //   nt8-i / nt8-d / nt8-a  - NinjaTrader 8 indicator / drawing tool / addon
    //   mt5-i / mt5-e / mt5-s  - MetaTrader 5 indicator / expert advisor / script
    //   mt4-i / mt4-e / mt4-s  - MetaTrader 4 indicator / expert advisor / script
    //   exe                    - standalone Windows app (download-only, see AppHubService)
    internal static class PlatformInstaller
    {
        public static string Normalize(string? platform) => (platform ?? "").Trim().ToLowerInvariant();

        public static bool IsMetaTraderFamily(string platform) =>
            platform.StartsWith("mt5-", StringComparison.Ordinal) || platform.StartsWith("mt4-", StringComparison.Ordinal);

        public static bool IsNinjaTraderFamily(string platform) => platform.StartsWith("nt8-", StringComparison.Ordinal);

        // NinjaTrader/MetaTrader must be fully closed before touching their
        // custom-script folders - a running terminal can hold file locks and,
        // for NinjaScript, silently fail to pick up a mid-session file change.
        public static bool IsTargetAppRunning(string platform, out string friendlyName)
        {
            if (IsNinjaTraderFamily(platform))
            {
                friendlyName = "NinjaTrader 8";
                return Process.GetProcessesByName("NinjaTrader").Length > 0;
            }
            if (platform.StartsWith("mt5-", StringComparison.Ordinal))
            {
                friendlyName = "MetaTrader 5";
                return Process.GetProcessesByName("terminal64").Length > 0;
            }
            if (platform.StartsWith("mt4-", StringComparison.Ordinal))
            {
                friendlyName = "MetaTrader 4";
                return Process.GetProcessesByName("terminal").Length > 0;
            }
            friendlyName = "";
            return false;
        }

        public static InstallResult Install(string platform, string sourceFilePath, string originalFileName)
        {
            platform = Normalize(platform);

            if (!File.Exists(sourceFilePath))
                return InstallResult.Fail("Downloaded file not found - download it again before installing.");

            if (IsTargetAppRunning(platform, out var friendlyName))
                return InstallResult.Fail($"Please fully close {friendlyName} before installing, then try again.");

            return platform switch
            {
                "nt8-i" => InstallNinjaTrader(sourceFilePath, originalFileName, "Indicators"),
                "nt8-d" => InstallNinjaTrader(sourceFilePath, originalFileName, "DrawingTools"),
                "nt8-a" => InstallNinjaTrader(sourceFilePath, originalFileName, "AddOns"),
                "exe" => InstallResult.Ok("EXE apps have no install step - use Open instead.", sourceFilePath),
                _ => InstallResult.Fail($"Platform '{platform}' must be installed via a MetaTrader terminal - use InstallMetaTrader instead."),
            };
        }

        // NinjaScript source files (.cs) copy straight into the matching Custom
        // subfolder, which NinjaTrader picks up on its next Compile (F5) - the
        // standard manual-install convention for NT8 add-ons. A packaged
        // NinjaScript export (.zip) can't be silently imported without a
        // verified command-line switch (not confirmed to exist), so it's
        // staged into an Imports folder instead and the result message tells
        // the user to finish via Tools > Import > NinjaScript Add-On in NT8.
        private static InstallResult InstallNinjaTrader(string sourceFilePath, string originalFileName, string category)
        {
            try
            {
                string documents = Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments);
                string customRoot = Path.Combine(documents, "NinjaTrader 8", "bin", "Custom");

                if (!Directory.Exists(Path.Combine(documents, "NinjaTrader 8")))
                    return InstallResult.Fail("NinjaTrader 8 installation not found under Documents\\NinjaTrader 8.");

                bool isZip = Path.GetExtension(originalFileName).Equals(".zip", StringComparison.OrdinalIgnoreCase);
                string targetDir = isZip
                    ? Path.Combine(customRoot, "Imports")
                    : Path.Combine(customRoot, category);

                Directory.CreateDirectory(targetDir);
                string targetPath = Path.Combine(targetDir, originalFileName);
                File.Copy(sourceFilePath, targetPath, overwrite: true);

                return isZip
                    ? InstallResult.Ok($"Staged at {targetPath}. Finish the install in NinjaTrader via Tools > Import > NinjaScript Add-On.", targetPath)
                    : InstallResult.Ok($"Installed to {targetPath}. Open NinjaTrader and Compile (F5) to activate it.", targetPath);
            }
            catch (Exception ex)
            {
                return InstallResult.Fail($"NinjaTrader install failed: {ex.Message}");
            }
        }

        // Every installed MT4 or MT5 terminal on this machine (one entry per
        // broker), detected from %AppData%\MetaQuotes\Terminal\<hash>\ data
        // folders. A folder counts as "MT5" if it has an MQL5 subfolder, "MT4"
        // if MQL4 - both can coexist since a hash folder belongs to exactly
        // one terminal build.
        public static List<TerminalInfo> FindTerminals(string platform)
        {
            string mqlFolderName = platform.StartsWith("mt5-", StringComparison.Ordinal) ? "MQL5"
                : platform.StartsWith("mt4-", StringComparison.Ordinal) ? "MQL4"
                : throw new ArgumentException($"Not a MetaTrader platform: {platform}");

            var result = new List<TerminalInfo>();
            try
            {
                string metaQuotesRoot = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "MetaQuotes", "Terminal");
                if (!Directory.Exists(metaQuotesRoot)) return result;

                foreach (var terminalDir in Directory.GetDirectories(metaQuotesRoot))
                {
                    if (!Directory.Exists(Path.Combine(terminalDir, mqlFolderName))) continue;

                    result.Add(new TerminalInfo
                    {
                        TerminalId = Path.GetFileName(terminalDir),
                        TerminalPath = terminalDir,
                        BrokerLabel = ReadBrokerLabel(terminalDir),
                    });
                }
            }
            catch { }
            return result;
        }

        // origin.txt (a MetaQuotes convention) holds the real terminal install
        // path, e.g. "C:\Program Files\XM MT5\terminal64.exe" - the install
        // folder name usually carries the broker/build's actual product name,
        // which is a far friendlier label than the terminal's data-folder hash.
        private static string ReadBrokerLabel(string terminalDir)
        {
            try
            {
                string originFile = Path.Combine(terminalDir, "origin.txt");
                if (File.Exists(originFile))
                {
                    string content = File.ReadAllText(originFile, Encoding.Unicode).Trim('\0', '\r', '\n', ' ');
                    if (string.IsNullOrWhiteSpace(content))
                        content = File.ReadAllText(originFile).Trim('\0', '\r', '\n', ' ');

                    if (!string.IsNullOrWhiteSpace(content))
                    {
                        string installDir = Path.GetDirectoryName(content) ?? content;
                        string label = Path.GetFileName(installDir.TrimEnd('\\', '/'));
                        if (!string.IsNullOrWhiteSpace(label)) return label;
                    }
                }
            }
            catch { }

            return $"Terminal {Path.GetFileName(terminalDir).Substring(0, Math.Min(8, terminalDir.Length))}";
        }

        // Copies the compiled file into one specific already-detected terminal.
        // Used both for a fresh Install (user-picked terminals) and an Update
        // (auto-targeted at whichever terminals already have this product).
        public static InstallResult InstallToTerminal(string platform, TerminalInfo terminal, string sourceFilePath, string originalFileName)
        {
            platform = Normalize(platform);
            string mqlFolderName = platform.StartsWith("mt5-", StringComparison.Ordinal) ? "MQL5" : "MQL4";
            string category = platform.EndsWith("-i") ? "Indicators" : platform.EndsWith("-e") ? "Experts" : "Scripts";

            try
            {
                string targetDir = Path.Combine(terminal.TerminalPath, mqlFolderName, category);
                Directory.CreateDirectory(targetDir);
                string targetPath = Path.Combine(targetDir, originalFileName);
                File.Copy(sourceFilePath, targetPath, overwrite: true);
                return InstallResult.Ok($"Installed to {terminal.BrokerLabel}.", targetPath);
            }
            catch (Exception ex)
            {
                return InstallResult.Fail($"Install to {terminal.BrokerLabel} failed: {ex.Message}");
            }
        }
    }
}
