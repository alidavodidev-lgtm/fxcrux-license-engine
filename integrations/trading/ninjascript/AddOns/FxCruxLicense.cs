// FxCruxLicense.cs
// Reusable TCP client for the local fxcrux.Engine TerminalGateway, usable
// from any NinjaScript Indicator, Strategy, AddOn, or DrawingTool. Talks the
// exact same challenge/response protocol as FxCruxLicense.mqh (MQL5/MQL4) -
// see that file's header for the full protocol description.
//
// Set the per-account pairing code shown in the FXCrux App Hub after login.
//
// NOT compiled/tested here (no NinjaTrader in this environment) - place this
// file under Documents\NinjaTrader 8\bin\Custom\AddOns\, compile in
// NinjaScript Editor, and report any errors.
//
// Deliberately a plain class (not a NinjaScript AddOn itself) so it can be
// instantiated directly from an Indicator/Strategy's OnStateChange - NinjaScript
// compiles everything under Custom\ into one assembly, so this type is visible
// to every script regardless of which Custom subfolder it lives in.

using System;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text;
using System.Threading;

namespace NinjaTrader.NinjaScript
{
    public class FxCruxLicenseClient : IDisposable
    {
        private const string Host = "127.0.0.1";
        private const int Port = 47651;
        private const int TimeoutMs = 3000;
        private const int MinReconnectSeconds = 2; // defense in depth, see FxCruxLicense.mqh's identical guard

        // Load the deployment's dedicated license-signing public key. The
        // corresponding private key stays on the server.
        private static string ReadSigningPublicKey()
        {
            string path = Environment.GetEnvironmentVariable("FXCRUX_SIGNING_PUBLIC_KEY_PATH");
            if (string.IsNullOrWhiteSpace(path))
                throw new InvalidOperationException("Set FXCRUX_SIGNING_PUBLIC_KEY_PATH to the server signing public key.");

            return System.IO.File.ReadAllText(path);
        }

        private readonly string _pairingCode;
        private readonly string _productName;
        private TcpClient _client;
        private NetworkStream _stream;
        private bool _authenticated;
        private DateTime _lastConnectAttempt = DateTime.MinValue;

        public FxCruxLicenseClient(string pairingCode, string productName)
        {
            _pairingCode = pairingCode ?? "";
            _productName = productName ?? "";
        }

        public bool IsReady => _authenticated && _client != null && _client.Connected;

        public bool Connect()
        {
            if ((DateTime.UtcNow - _lastConnectAttempt).TotalSeconds < MinReconnectSeconds)
                return false;
            _lastConnectAttempt = DateTime.UtcNow;

            _authenticated = false;
            Disconnect();

            if (string.IsNullOrEmpty(_pairingCode))
            {
                Log("No pairing code set - log in with the FXCrux Windows app and paste your pairing code into this script's parameters.");
                return false;
            }

            try
            {
                _client = new TcpClient();
                if (!_client.ConnectAsync(Host, Port).Wait(TimeoutMs))
                {
                    Log("Could not connect to Engine on " + Host + ":" + Port + " - is fxcrux.Engine running?");
                    return false;
                }

                _stream = _client.GetStream();
                _stream.ReadTimeout = TimeoutMs;
                _stream.WriteTimeout = TimeoutMs;

                string challengeLine = ReadLine();
                string nonce = JsonGetString(challengeLine, "nonce");
                if (string.IsNullOrEmpty(nonce))
                {
                    // Close immediately instead of leaving a half-open socket
                    // for the *next* Connect() call to close - a half-open
                    // socket here means the Engine is still blocked waiting on
                    // a reply that never comes, only finding out (and logging
                    // a confusing "connection aborted" error) once this side
                    // finally closes it.
                    Log("No challenge received from Engine (timed out after " + TimeoutMs + "ms).");
                    Disconnect();
                    return false;
                }

                string response = Sha256Hex(nonce + _pairingCode);
                WriteLine("{\"type\":\"AUTH\",\"response\":\"" + response + "\"}");

                string authResult = ReadLine();
                if (authResult.IndexOf("AUTH_OK", StringComparison.Ordinal) < 0)
                {
                    string reason = JsonGetString(authResult, "reason");
                    Log(reason == "not_paired"
                        ? "Engine has no pairing code loaded yet - log in with the FXCrux Windows app first."
                        : "Engine rejected the handshake (wrong pairing code?). Reply: " + authResult);
                    Disconnect();
                    return false;
                }

                _authenticated = true;
                return true;
            }
            catch (Exception ex)
            {
                Log("Connect failed: " + ex.Message);
                return false;
            }
        }

        // True only after a CheckLicense() call whose signature verified -
        // gates access to FxCruxSecretVault.DecryptSecrets(), see that class.
        public bool LastCheckVerified { get; private set; }

        // Returns false (fail-closed) on any connection/protocol/signature error.
        // A response reporting active:true is NOT trusted on its own - it must
        // also carry a valid RSA-PSS signature over {userId, product, issuedAt,
        // expiresAt} from the backend's dedicated signing key. This is what
        // stops a patched build (license check deleted) or a fake/emulated
        // Engine from ever producing a result this method accepts as active:
        // neither can forge a signature without the private key.
        public bool CheckLicense(out DateTime expiresAt)
        {
            expiresAt = DateTime.MinValue;
            LastCheckVerified = false;

            if (!IsReady && !Connect())
                return false;

            try
            {
                WriteLine("{\"type\":\"CHECK_LICENSE\",\"product\":\"" + _productName + "\"}");
                string statusLine = ReadLine();
                if (string.IsNullOrEmpty(statusLine)) return false;

                bool active = statusLine.IndexOf("\"active\":true", StringComparison.Ordinal) >= 0;
                string expiresStr = JsonGetString(statusLine, "expiresAt");
                if (!string.IsNullOrEmpty(expiresStr))
                    DateTime.TryParse(expiresStr, out expiresAt);

                if (!active)
                    return false;

                string signature = JsonGetString(statusLine, "signature");
                string issuedAt = JsonGetString(statusLine, "issuedAt");
                string userId = JsonGetString(statusLine, "userId");

                bool verified = VerifySignature(userId, _productName, issuedAt, expiresStr, signature);
                if (!verified)
                {
                    Log("License response failed signature verification - treating as inactive. " +
                        "This means either the Engine/backend is out of date, or something between " +
                        "them and this script is not the real FXCRUX backend.");
                    return false;
                }

                LastCheckVerified = true;
                return true;
            }
            catch (Exception ex)
            {
                Log("CheckLicense failed: " + ex.Message);
                _authenticated = false;
                return false;
            }
        }

        // Verifies against the *exact raw strings* received off the wire -
        // never a reparsed/reformatted DateTime, since that would silently
        // produce different bytes than what the backend actually signed.
        private static bool VerifySignature(string userId, string product, string issuedAt, string expiresAt, string signatureBase64)
        {
            if (string.IsNullOrEmpty(userId) || string.IsNullOrEmpty(issuedAt) ||
                string.IsNullOrEmpty(expiresAt) || string.IsNullOrEmpty(signatureBase64))
                return false;

            try
            {
                string canonical = "v1|" + userId + "|" + product + "|" + issuedAt + "|" + expiresAt;
                byte[] canonicalBytes = Encoding.UTF8.GetBytes(canonical);
                byte[] signatureBytes = Convert.FromBase64String(signatureBase64);

                using (var rsa = RSA.Create())
                {
                    rsa.ImportFromPem(ReadSigningPublicKey());
                    return rsa.VerifyData(canonicalBytes, signatureBytes, HashAlgorithmName.SHA256, RSASignaturePadding.Pss);
                }
            }
            catch
            {
                // Malformed base64, wrong key, tampered payload, etc. - all fail closed.
                return false;
            }
        }

        public void Disconnect()
        {
            try { _stream?.Dispose(); } catch { }
            try { _client?.Close(); } catch { }
            _stream = null;
            _client = null;
            _authenticated = false;
        }

        public void Dispose() => Disconnect();

        private void WriteLine(string line)
        {
            byte[] bytes = Encoding.UTF8.GetBytes(line + "\n");
            _stream.Write(bytes, 0, bytes.Length);
        }

        // Byte-oriented, not real UTF-8 decoding - fine for this protocol
        // since every field it ever sends (type/nonce/active/product/expiresAt)
        // is ASCII; would need proper multi-byte buffering if that ever changes.
        private string ReadLine()
        {
            var sb = new StringBuilder();
            var buffer = new byte[1];
            var start = DateTime.UtcNow;
            while ((DateTime.UtcNow - start).TotalMilliseconds < TimeoutMs)
            {
                if (!_stream.DataAvailable) { Thread.Sleep(10); continue; }
                int read = _stream.Read(buffer, 0, 1);
                if (read <= 0) break;
                if (buffer[0] == '\n') return sb.ToString();
                sb.Append((char)buffer[0]);
            }
            return sb.ToString();
        }

        private static string JsonGetString(string json, string field)
        {
            if (string.IsNullOrEmpty(json)) return "";
            string needle = "\"" + field + "\":\"";
            int pos = json.IndexOf(needle, StringComparison.Ordinal);
            if (pos < 0) return "";
            int start = pos + needle.Length;
            int end = json.IndexOf('"', start);
            return end < 0 ? "" : json.Substring(start, end - start);
        }

        private static string Sha256Hex(string text)
        {
            using (var sha = SHA256.Create())
            {
                byte[] hash = sha.ComputeHash(Encoding.UTF8.GetBytes(text));
                var sb = new StringBuilder(hash.Length * 2);
                foreach (byte b in hash) sb.Append(b.ToString("x2"));
                return sb.ToString();
            }
        }

        private static void Log(string message)
        {
            try { NinjaTrader.Code.Output.Process("[FxCrux] " + message, PrintTo.OutputTab1); }
            catch { /* Output API unavailable outside a running script context */ }
        }
    }
}
