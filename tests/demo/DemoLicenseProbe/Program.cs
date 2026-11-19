using System.Text.Json;
using Fxcrux.Licensing;

var input = await JsonSerializer.DeserializeAsync<ProbeInput>(Console.OpenStandardInput())
    ?? throw new InvalidOperationException("Provide the demo probe input on stdin.");
using var http = new HttpClient(new HttpClientHandler { AllowAutoRedirect = false })
{
    Timeout = TimeSpan.FromSeconds(10),
};
var client = new LicenseClient(http, input.ApiUrl, input.ProductId);
var result = await client.ValidateAsync(input.LicenseKey, input.MachineCode);
Console.WriteLine(result.Status);

internal sealed record ProbeInput(Uri ApiUrl, Guid ProductId, string LicenseKey, string MachineCode);
