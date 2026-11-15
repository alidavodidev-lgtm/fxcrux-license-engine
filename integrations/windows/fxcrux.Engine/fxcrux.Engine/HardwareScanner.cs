using System.Management;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Win32;

namespace fxcrux.Engine
{
    public static class HardwareScanner
    {
        public static string GenerateMachineId()
        {
            string cpuId = GetCpuId();
            string baseBoard = GetBaseBoardId();
            string volumeSerial = GetVolumeSerial("C");
            string machineGuid = GetMachineGuid();

            string rawId = $"{cpuId}-{baseBoard}-{volumeSerial}-{machineGuid}-{Constants.DeviceNamespace}";

            return HashString(rawId);
        }

        private static string GetCpuId()
        {
            try
            {
                using (ManagementObjectSearcher searcher = new ManagementObjectSearcher("SELECT ProcessorId FROM Win32_Processor"))
                {
                    foreach (ManagementObject mo in searcher.Get())
                        return mo["ProcessorId"]?.ToString().Trim() ?? "UNKNOWN_CPU";
                }
            }
            catch { }
            return "UNKNOWN_CPU";
        }

        private static string GetBaseBoardId()
        {
            try
            {
                using (ManagementObjectSearcher searcher = new ManagementObjectSearcher("SELECT SerialNumber FROM Win32_BaseBoard"))
                {
                    foreach (ManagementObject mo in searcher.Get())
                        return mo["SerialNumber"]?.ToString().Trim() ?? "UNKNOWN_BOARD";
                }
            }
            catch { }
            return "UNKNOWN_BOARD";
        }

        private static string GetVolumeSerial(string driveLetter)
        {
            try
            {
                using (ManagementObjectSearcher searcher = new ManagementObjectSearcher($"SELECT VolumeSerialNumber FROM Win32_LogicalDisk WHERE DeviceID = '{driveLetter}:'"))
                {
                    foreach (ManagementObject mo in searcher.Get())
                        return mo["VolumeSerialNumber"]?.ToString().Trim() ?? "UNKNOWN_VOLUME";
                }
            }
            catch { }
            return "UNKNOWN_VOLUME";
        }

        private static string GetMachineGuid()
        {
            try
            {
                using (RegistryKey localMachineX64View = RegistryKey.OpenBaseKey(RegistryHive.LocalMachine, RegistryView.Registry64))
                {
                    using (RegistryKey rk = localMachineX64View.OpenSubKey(@"SOFTWARE\Microsoft\Cryptography"))
                    {
                        if (rk != null)
                        {
                            object machineGuid = rk.GetValue("MachineGuid");
                            if (machineGuid != null) return machineGuid.ToString();
                        }
                    }
                }
            }
            catch { }
            return "UNKNOWN_GUID";
        }

        private static string HashString(string input)
        {
            using (SHA256 sha256 = SHA256.Create())
            {
                byte[] bytes = Encoding.UTF8.GetBytes(input);
                byte[] hashBytes = sha256.ComputeHash(bytes);

                StringBuilder builder = new StringBuilder();
                foreach (byte b in hashBytes)
                {
                    builder.Append(b.ToString("X2"));
                }
                return builder.ToString();
            }
        }
    }
}