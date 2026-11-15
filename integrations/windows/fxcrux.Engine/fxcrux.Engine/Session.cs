namespace fxcrux.Engine
{
    // Process-wide session state, shared between Program.cs (Named Pipe /
    // login), TerminalGateway.cs (local trading-terminal handshake), and the
    // heartbeat loop. A single small holder is simpler and less error-prone
    // than threading these values through every method signature.
    internal static class Session
    {
        public static bool IsAuthenticated { get; set; }
        public static string Username { get; set; } = "";
        public static string MachineId { get; set; } = "";
        public static string? CurrentPairingSecret { get; set; }
        public static string LastLoginError { get; set; } = "Invalid credentials or account banned.";
    }
}
