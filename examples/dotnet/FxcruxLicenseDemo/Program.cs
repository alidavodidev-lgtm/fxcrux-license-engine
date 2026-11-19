namespace FxcruxLicenseDemo;

internal static class Program
{
    [STAThread]
    private static void Main()
    {
        ApplicationConfiguration.Initialize();

        try
        {
            using var window = new DemoWindow(InstallationId.LoadOrCreate());
            Application.Run(window);
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException)
        {
            MessageBox.Show("The demo could not load or save its local Machine Code.",
                "FXCRUX License Demo", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }
}
