using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace Fxcrux.Licensing;

/// <summary>The outcome of a license check.</summary>
public enum LicenseStatus
{
    /// <summary>The API accepted the entitlement.</summary>
    Valid,
    /// <summary>The API did not recognize the license key.</summary>
    UnknownKey,
    /// <summary>The API refused the entitlement.</summary>
    Rejected,
    /// <summary>The API rate limit was reached.</summary>
    RateLimited,
    /// <summary>Network or timeout error.</summary>
    Unreachable,
    /// <summary>The response did not match the validation contract.</summary>
    UnexpectedResponse,
}

/// <summary>A validation outcome and the expiry of an accepted entitlement, if available.</summary>
/// <param name="Status">The outcome of the check.</param>
/// <param name="ExpiresAt">The accepted entitlement's expiry.</param>
public sealed record LicenseResult(LicenseStatus Status, DateTimeOffset? ExpiresAt = null);

/// <summary>Checks product entitlements against the FXCRUX API.</summary>
public sealed class LicenseClient
{
    private readonly HttpClient httpClient;
    private readonly Uri validationUri;
    private readonly Guid productId;

    /// <summary>Creates a client for one product using a caller-owned HTTP transport.</summary>
    /// <param name="httpClient">HTTP transport and timeout settings.</param>
    /// <param name="apiBaseUrl">Absolute HTTP or HTTPS API base URL, optionally with a path prefix.</param>
    /// <param name="productId">The product UUID from the FXCRUX dashboard.</param>
    public LicenseClient(HttpClient httpClient, Uri apiBaseUrl, Guid productId)
    {
        ArgumentNullException.ThrowIfNull(httpClient);
        ArgumentNullException.ThrowIfNull(apiBaseUrl);
        if (!apiBaseUrl.IsAbsoluteUri ||
            (apiBaseUrl.Scheme != Uri.UriSchemeHttp && apiBaseUrl.Scheme != Uri.UriSchemeHttps) ||
            apiBaseUrl.Query.Length > 0 || apiBaseUrl.Fragment.Length > 0 || apiBaseUrl.UserInfo.Length > 0)
        {
            throw new ArgumentException("Use an HTTP or HTTPS API base URL without credentials, a query, or a fragment.", nameof(apiBaseUrl));
        }

        if (productId == Guid.Empty)
        {
            throw new ArgumentException("Set the product UUID.", nameof(productId));
        }

        this.httpClient = httpClient;
        this.productId = productId;
        validationUri = new Uri(apiBaseUrl.AbsoluteUri.TrimEnd('/') + "/licenses/validate");
    }

    /// <summary>Checks a license and supplies the installation ID for first-time binding.</summary>
    /// <param name="licenseKey">The customer license key.</param>
    /// <param name="machineId">The stable installation identifier provided by the application.</param>
    /// <param name="cancellationToken">Cancellation for the in-progress request.</param>
    /// <returns>The entitlement outcome.</returns>
    public async Task<LicenseResult> ValidateAsync(
        string licenseKey, string machineId, CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(licenseKey);
        ArgumentException.ThrowIfNullOrWhiteSpace(machineId);

        try
        {
            using var response = await httpClient.PostAsJsonAsync(
                validationUri, new { productId, licenseKey, machineId }, cancellationToken).ConfigureAwait(false);

            return response.StatusCode switch
            {
                HttpStatusCode.OK => await ReadAcceptedAsync(response.Content, cancellationToken).ConfigureAwait(false),
                HttpStatusCode.NotFound => new(LicenseStatus.UnknownKey),
                HttpStatusCode.Forbidden => new(LicenseStatus.Rejected),
                HttpStatusCode.TooManyRequests => new(LicenseStatus.RateLimited),
                _ => new(LicenseStatus.UnexpectedResponse),
            };
        }
        catch (HttpRequestException)
        {
            return new(LicenseStatus.Unreachable);
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            return new(LicenseStatus.Unreachable);
        }
        catch (JsonException)
        {
            return new(LicenseStatus.UnexpectedResponse);
        }
    }

    private static async Task<LicenseResult> ReadAcceptedAsync(HttpContent content, CancellationToken cancellationToken)
    {
        await using var stream = await content.ReadAsStreamAsync(cancellationToken).ConfigureAwait(false);
        using var document = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken).ConfigureAwait(false);
        var result = document.RootElement;
        if (result.ValueKind != JsonValueKind.Object ||
            !result.TryGetProperty("status", out var status) ||
            status.ValueKind != JsonValueKind.String || status.GetString() != "success" ||
            !result.TryGetProperty("expires_at", out var expiry) ||
            expiry.ValueKind != JsonValueKind.String || !expiry.TryGetDateTimeOffset(out var date))
        {
            return new(LicenseStatus.UnexpectedResponse);
        }

        return new(LicenseStatus.Valid, date);
    }
}
