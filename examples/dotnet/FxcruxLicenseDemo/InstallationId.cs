namespace FxcruxLicenseDemo;

internal static class InstallationId
{
    internal static Guid LoadOrCreate()
    {
        var directory = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "FXCRUX", "LicenseDemo");
        Directory.CreateDirectory(directory);
        var path = Path.Combine(directory, "machine-code.txt");

        // Serialize first startup across application instances for the same Windows user.
        using var mutex = new Mutex(false, @"Local\FXCRUX.LicenseDemo.InstallationId");
        try
        {
            mutex.WaitOne();
        }
        catch (AbandonedMutexException)
        {
            // The previous process exited while holding the mutex. This process now owns it.
        }

        try
        {
            if (File.Exists(path))
            {
                if (Guid.TryParse(File.ReadAllText(path).Trim(), out var saved) && saved != Guid.Empty)
                {
                    return saved;
                }

                throw new IOException("The saved Machine Code is invalid.");
            }

            var id = Guid.NewGuid();
            var temporaryPath = path + ".tmp";
            File.WriteAllText(temporaryPath, id.ToString("D"));
            File.Move(temporaryPath, path);
            return id;
        }
        finally
        {
            mutex.ReleaseMutex();
        }
    }
}
