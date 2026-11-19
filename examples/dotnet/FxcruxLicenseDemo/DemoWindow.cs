using Fxcrux.Licensing;

namespace FxcruxLicenseDemo;

internal sealed class DemoWindow : Form
{
    private readonly HttpClient httpClient = new(new HttpClientHandler { AllowAutoRedirect = false })
    {
        Timeout = TimeSpan.FromSeconds(10),
    };
    private readonly TextBox apiUrl = new() { Text = "http://localhost:3000" };
    private readonly TextBox productId = new();
    private readonly TextBox licenseKey = new() { UseSystemPasswordChar = true };
    private readonly Button check = new() { Text = "Activate / Check License", AutoSize = true };
    private readonly Button premium = new() { Text = "Use Premium Feature", AutoSize = true, Enabled = false };
    private readonly Label status = new() { Text = "Enter the product ID and license key to activate.", AutoSize = true };
    private readonly string machineId;

    internal DemoWindow(Guid installationId)
    {
        machineId = installationId.ToString("D");
        Text = "FXCRUX License Demo";
        AutoScaleMode = AutoScaleMode.Font;
        StartPosition = FormStartPosition.CenterScreen;
        ClientSize = new Size(580, 285);
        MinimumSize = new Size(550, 315);

        var layout = new TableLayoutPanel { Dock = DockStyle.Fill, Padding = new Padding(16), ColumnCount = 3 };
        layout.ColumnStyles.Add(new ColumnStyle(SizeType.AutoSize));
        layout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
        layout.ColumnStyles.Add(new ColumnStyle(SizeType.AutoSize));
        Controls.Add(layout);

        AddField(layout, "API URL", apiUrl, 0);
        AddField(layout, "Product ID", productId, 1);
        AddField(layout, "License key", licenseKey, 2);
        AddField(layout, "Machine Code", new TextBox { Text = machineId, ReadOnly = true }, 3);

        var copy = new Button { Text = "Copy", AutoSize = true };
        copy.Click += (_, _) => Clipboard.SetText(machineId);
        layout.Controls.Add(copy, 2, 3);
        layout.Controls.Add(check, 1, 4);
        layout.Controls.Add(status, 1, 5);
        layout.SetColumnSpan(status, 2);
        layout.Controls.Add(premium, 1, 6);

        apiUrl.TextChanged += ClearActivation;
        productId.TextChanged += ClearActivation;
        licenseKey.TextChanged += ClearActivation;
        check.Click += CheckLicenseAsync;
        premium.Click += (_, _) => MessageBox.Show(this, "Premium feature enabled for this installation.",
            "FXCRUX License Demo", MessageBoxButtons.OK, MessageBoxIcon.Information);
        AcceptButton = check;
    }

    private static void AddField(TableLayoutPanel layout, string name, TextBox input, int row)
    {
        layout.Controls.Add(new Label { Text = name, AutoSize = true, Anchor = AnchorStyles.Left }, 0, row);
        input.Dock = DockStyle.Fill;
        layout.Controls.Add(input, 1, row);
    }

    private void ClearActivation(object? sender, EventArgs args)
    {
        premium.Enabled = false;
        status.Text = "Check the license to activate Premium.";
    }

    private async void CheckLicenseAsync(object? sender, EventArgs args)
    {
        premium.Enabled = false;
        if (!Guid.TryParse(productId.Text.Trim(), out var id) || id == Guid.Empty ||
            string.IsNullOrWhiteSpace(licenseKey.Text))
        {
            status.Text = "Enter a product UUID and license key.";
            return;
        }

        LicenseClient client;
        try
        {
            client = new LicenseClient(httpClient, new Uri(apiUrl.Text.Trim(), UriKind.Absolute), id);
        }
        catch (Exception error) when (error is UriFormatException or ArgumentException)
        {
            status.Text = "Enter a valid API URL, such as http://localhost:3000.";
            return;
        }

        apiUrl.Enabled = productId.Enabled = licenseKey.Enabled = check.Enabled = false;
        status.Text = "Checking license…";
        try
        {
            var result = await client.ValidateAsync(licenseKey.Text.Trim(), machineId);
            if (IsDisposed) return;

            premium.Enabled = result.Status == LicenseStatus.Valid;
            status.Text = result.Status switch
            {
                LicenseStatus.Valid => $"Active until {result.ExpiresAt?.ToLocalTime():g}.",
                LicenseStatus.UnknownKey => "The API did not recognize that license key.",
                LicenseStatus.Rejected => "The API rejected the license for this product or installation.",
                LicenseStatus.RateLimited => "Too many checks. Wait before trying again.",
                LicenseStatus.Unreachable => "Could not reach the API. Check its address and status.",
                _ => "The API returned an unexpected response.",
            };
        }
        finally
        {
            if (!IsDisposed)
            {
                apiUrl.Enabled = productId.Enabled = licenseKey.Enabled = check.Enabled = true;
            }
        }
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing) httpClient.Dispose();
        base.Dispose(disposing);
    }
}
