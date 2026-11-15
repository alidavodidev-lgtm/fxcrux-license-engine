const { FXCRUX_API_URL, FXCRUX_PRODUCT_ID, FXCRUX_LICENSE_KEY, FXCRUX_DEVICE_ID } = process.env;

if (!FXCRUX_API_URL || !FXCRUX_PRODUCT_ID || !FXCRUX_LICENSE_KEY || !FXCRUX_DEVICE_ID) {
  console.error('Set FXCRUX_API_URL, FXCRUX_PRODUCT_ID, FXCRUX_LICENSE_KEY, and FXCRUX_DEVICE_ID.');
  process.exit(2);
}

try {
  const endpoint = new URL('/licenses/validate', FXCRUX_API_URL);
  if (endpoint.username || endpoint.password) throw new Error('Keep credentials out of the API URL.');
  const local = ['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname);
  if (endpoint.protocol !== 'https:' && !(local && endpoint.protocol === 'http:')) {
    throw new Error('Use HTTPS for a remote licensing API.');
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      productId: FXCRUX_PRODUCT_ID,
      licenseKey: FXCRUX_LICENSE_KEY,
      machineId: FXCRUX_DEVICE_ID,
    }),
    redirect: 'error',
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`License check failed (HTTP ${response.status}).`);
  const result = await response.json();
  if (result.status !== 'success') throw new Error('Unexpected license response.');
  console.log(`License accepted. Expires at ${result.expires_at}.`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
