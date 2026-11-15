using System;
using System.Management;
using System.Runtime.Intrinsics.X86;
using System.Text;
using Microsoft.Win32;

namespace fxcrux.Engine
{
    // Identifies guest environments for deployments that opt in to blocking
    // virtual-machine hardware login.
    //
    // IMPORTANT (fixed 2026-07-14 after a real false positive): the raw CPUID
    // "hypervisor present" bit and the Hyper-V NIC MAC-vendor prefix are NOT
    // reliable "I am a guest VM" signals on their own - Windows sets/creates
    // both of them on a genuinely physical machine too, any time Hyper-V-based
    // Virtualization-Based Security (Core Isolation / Memory Integrity, on by
    // default on many modern OEM machines), WSL2, Docker Desktop, or Windows
    // Sandbox is active. Only a small set of vendor CPUID IDs (VMware,
    // VirtualBox, KVM/QEMU, Xen, Parallels, bhyve - never legitimately present
    // on a bare-metal desktop) block on their own; everything Hyper-V-shaped
    // requires corroboration from a genuine guest-only artifact (WMI
    // manufacturer/model, BIOS/board vendor strings, or guest-integration
    // registry keys - none of which change on a physical host just because
    // its own Hyper-V role is enabled).
    public static class VmDetector
    {
        private static readonly string[] VendorSignatures =
        {
            "vmware", "virtualbox", "vbox", "qemu", "kvm", "xen", "parallels",
            "virtual machine", "innotek", "bochs", "hvm domu",
        };

        // Vendor CPUID IDs (leaf 0x40000000) that are essentially never present
        // on physical, non-virtualized hardware - safe to block on immediately.
        // Deliberately excludes "Microsoft Hv" (Hyper-V): that vendor ID is
        // reported by the CPU any time Windows' own hypervisor is active,
        // including on the physical host itself (VBS/WSL2/Docker/Sandbox).
        private static readonly string[] DefinitiveHypervisorVendors =
        {
            "VMwareVMware", "VBoxVBoxVBox", "KVMKVMKVM", "TCGTCGTCGTCG",
            "XenVMMXenVMM", "prl hyperv", "bhyve bhyve",
        };

        public static bool IsVirtualMachine(out string reason)
        {
            if (CheckDefinitiveHypervisorVendor(out reason)) return true;
            if (CheckComputerSystem(out reason)) return true;
            if (CheckBios(out reason)) return true;
            if (CheckBaseBoard(out reason)) return true;
            if (CheckMacAddress(out reason)) return true;
            if (CheckGuestToolsRegistry(out reason)) return true;

            reason = "";
            return false;
        }

        private static bool CheckDefinitiveHypervisorVendor(out string reason)
        {
            reason = "";
            try
            {
                if (!X86Base.IsSupported) return false;

                var leaf1 = X86Base.CpuId(1, 0);
                bool hypervisorPresent = (leaf1.Ecx & (1 << 31)) != 0;
                if (!hypervisorPresent) return false;

                var leaf = X86Base.CpuId(0x40000000, 0);
                var bytes = new byte[12];
                BitConverter.GetBytes(leaf.Ebx).CopyTo(bytes, 0);
                BitConverter.GetBytes(leaf.Ecx).CopyTo(bytes, 4);
                BitConverter.GetBytes(leaf.Edx).CopyTo(bytes, 8);
                string vendor = Encoding.ASCII.GetString(bytes);

                foreach (var known in DefinitiveHypervisorVendors)
                {
                    if (vendor.StartsWith(known, StringComparison.OrdinalIgnoreCase))
                    {
                        reason = $"CPUID hypervisor vendor: {vendor.Trim()}";
                        return true;
                    }
                }
            }
            catch { }
            return false;
        }

        private static bool CheckComputerSystem(out string reason)
        {
            reason = "";
            try
            {
                using var searcher = new ManagementObjectSearcher("SELECT Model, Manufacturer FROM Win32_ComputerSystem");
                foreach (ManagementObject mo in searcher.Get())
                {
                    string model = mo["Model"]?.ToString() ?? "";
                    string manufacturer = mo["Manufacturer"]?.ToString() ?? "";
                    if (ContainsSignature(model) || ContainsSignature(manufacturer))
                    {
                        reason = $"ComputerSystem manufacturer/model: {manufacturer} / {model}";
                        return true;
                    }
                }
            }
            catch { }
            return false;
        }

        private static bool CheckBios(out string reason)
        {
            reason = "";
            try
            {
                using var searcher = new ManagementObjectSearcher("SELECT SerialNumber, Manufacturer, Version FROM Win32_BIOS");
                foreach (ManagementObject mo in searcher.Get())
                {
                    string serial = mo["SerialNumber"]?.ToString() ?? "";
                    string manufacturer = mo["Manufacturer"]?.ToString() ?? "";
                    string version = mo["Version"]?.ToString() ?? "";
                    if (ContainsSignature(serial) || ContainsSignature(manufacturer) || ContainsSignature(version))
                    {
                        reason = $"BIOS manufacturer/version: {manufacturer} / {version}";
                        return true;
                    }
                }
            }
            catch { }
            return false;
        }

        private static bool CheckBaseBoard(out string reason)
        {
            reason = "";
            try
            {
                using var searcher = new ManagementObjectSearcher("SELECT Manufacturer, Product FROM Win32_BaseBoard");
                foreach (ManagementObject mo in searcher.Get())
                {
                    string manufacturer = mo["Manufacturer"]?.ToString() ?? "";
                    string product = mo["Product"]?.ToString() ?? "";
                    if (ContainsSignature(manufacturer) || ContainsSignature(product))
                    {
                        reason = $"BaseBoard manufacturer/product: {manufacturer} / {product}";
                        return true;
                    }
                }
            }
            catch { }
            return false;
        }

        // Known VM NIC vendor OUIs: VMware (00:05:69, 00:0C:29, 00:1C:14, 00:50:56),
        // VirtualBox (08:00:27), Xen/Citrix (00:16:3E), QEMU/Bochs (52:54:00).
        // Deliberately excludes Hyper-V's 00:15:5D - the physical host's own
        // Hyper-V virtual switch (created by WSL2/Docker Desktop/Sandbox) uses
        // that same OUI on adapters that are IP-enabled on the host itself.
        private static readonly string[] VmMacPrefixes =
        {
            "00:05:69", "00:0C:29", "00:1C:14", "00:50:56",
            "08:00:27", "00:16:3E", "52:54:00",
        };

        private static bool CheckMacAddress(out string reason)
        {
            reason = "";
            try
            {
                using var searcher = new ManagementObjectSearcher(
                    "SELECT MACAddress FROM Win32_NetworkAdapterConfiguration WHERE IPEnabled = TRUE");
                foreach (ManagementObject mo in searcher.Get())
                {
                    string mac = mo["MACAddress"]?.ToString() ?? "";
                    foreach (var prefix in VmMacPrefixes)
                    {
                        if (mac.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
                        {
                            reason = $"NIC MAC vendor prefix matches a known hypervisor: {mac}";
                            return true;
                        }
                    }
                }
            }
            catch { }
            return false;
        }

        // Guest-tools registry keys are only ever present when the OS is
        // actually running as a guest under that specific hypervisor.
        private static bool CheckGuestToolsRegistry(out string reason)
        {
            reason = "";
            string[] guestToolKeys =
            {
                @"SOFTWARE\VMware, Inc.\VMware Tools",
                @"SOFTWARE\Oracle\VirtualBox Guest Additions",
                @"SOFTWARE\Microsoft\Virtual Machine\Guest\Parameters",
            };

            try
            {
                using var hklm = RegistryKey.OpenBaseKey(RegistryHive.LocalMachine, RegistryView.Registry64);
                foreach (var keyPath in guestToolKeys)
                {
                    using var rk = hklm.OpenSubKey(keyPath);
                    if (rk != null)
                    {
                        reason = $"Guest-tools registry key present: {keyPath}";
                        return true;
                    }
                }
            }
            catch { }
            return false;
        }

        private static bool ContainsSignature(string value)
        {
            if (string.IsNullOrEmpty(value)) return false;
            foreach (var sig in VendorSignatures)
            {
                if (value.Contains(sig, StringComparison.OrdinalIgnoreCase)) return true;
            }
            return false;
        }
    }
}
