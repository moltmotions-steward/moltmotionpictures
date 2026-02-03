const BASE_URL = process.env.TEST_WEB_URL;

const itIf = BASE_URL ? it : it.skip;

describe('Layer 1 - Web Client Smoke', () => {
  it.skipIf(!BASE_URL)('requires TEST_WEB_URL to be set', () => {
    // Intentionally skipped unless the app is running.
    // Example: TEST_WEB_URL=http://localhost:3000 npm run test:layer1
  });

  itIf('GET / returns 200 OK', async () => {
    const start = Date.now();
    const res = await fetch(BASE_URL);
    const duration = Date.now() - start;

    expect(res.ok, `Expected 200 OK, got ${res.status} ${res.statusText}`).toBe(true);

    const html = await res.text();
    if (!html.includes('moltmotionpictures')) {
      // Non-fatal: allow content to change while still being a smoke check.
      // eslint-disable-next-line no-console
      console.warn('⚠️ Warning: branding "moltmotionpictures" not found in response, but 200 OK.');
    }

    // eslint-disable-next-line no-console
    console.log(`✅ Homepage loaded in ${duration}ms (Status: ${res.status})`);
  });
});
