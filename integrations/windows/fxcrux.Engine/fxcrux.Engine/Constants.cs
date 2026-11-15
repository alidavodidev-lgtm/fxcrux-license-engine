namespace fxcrux.Engine
{
    public static class Constants
    {
        public const string PipeName = "FXCrux_Core_Secure_Pipe";
        public static string DeviceNamespace => System.Environment.GetEnvironmentVariable("FXCRUX_DEVICE_NAMESPACE") ?? "FXCRUX-License-Engine";
        public const string CmdGetMachineId = "GET_MACHINE_ID";

        // Local-only TCP gateway for trading terminals (MT5/NinjaTrader).
        // NOTE: there is deliberately no compile-time shared secret here any more -
        // see SecureStorage/User.terminal_pairing_secret. A single global constant
        // shipped inside every customer's MQL5 .mqh let anyone extract it and run a
        // fake local "Engine" that always answers active:true for every customer;
        // the per-account secret minted at hardware-login limits that blast radius
        // to the one account that leaks its own value.
        public const int TerminalGatewayPort = 47651;
        public static string BackendBaseUrl => (System.Environment.GetEnvironmentVariable("FXCRUX_BACKEND_URL") ?? "http://127.0.0.1:3000").TrimEnd('/');

        // How often the heartbeat loop re-checks the account's active licenses
        // once authenticated (drives EXE auto-delete-on-expiry + local state refresh).
        public const int HeartbeatIntervalSeconds = 300;
    }
}