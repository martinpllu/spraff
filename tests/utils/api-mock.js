/**
 * API mocking utilities for Playwright tests.
 * Mocks OpenRouter API to control test scenarios.
 */

/**
 * Generate a mock streaming response in SSE format.
 * @param {string} transcript - The user transcript to include
 * @param {string} response - The assistant's response text
 * @returns {string} SSE-formatted response body
 */
function generateMockStreamResponse(transcript, response) {
  const lines = [];

  // Add transcript in [USER] tags
  if (transcript) {
    lines.push(
      `data: {"choices":[{"delta":{"content":"[USER]\\n${transcript}\\n[/USER]\\n\\n"}}]}`
    );
  }

  // Add response content
  lines.push(`data: {"choices":[{"delta":{"content":"${response}"}}]}`);

  // Add usage/cost info
  lines.push(`data: {"usage":{"cost":0.0001}}`);

  // End marker
  lines.push('data: [DONE]');

  return lines.join('\n\n');
}

/**
 * Setup API mocking for OpenRouter endpoints.
 * @param {import('@playwright/test').Page} page
 * @param {Object} options
 * @param {string} options.transcript - Mocked user transcript
 * @param {string} options.response - Mocked assistant response
 */
export async function mockOpenRouterAPI(page, options = {}) {
  const { transcript = 'Hello', response = 'Hi there! How can I help you?' } =
    options;

  await page.route('**/openrouter.ai/api/v1/**', async (route) => {
    const url = route.request().url();

    // Chat completions endpoint
    if (url.includes('/chat/completions')) {
      await route.fulfill({
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
        body: generateMockStreamResponse(transcript, response),
      });
      return;
    }

    // Auth/keys endpoint
    if (url.includes('/auth/keys')) {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ key: 'test-api-key-12345' }),
      });
      return;
    }

    // Credits endpoint
    if (url.includes('/credits')) {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          data: { total_credits: 100, total_usage: 0 },
        }),
      });
      return;
    }

    // Pass through other requests
    await route.continue();
  });
}

/**
 * Setup mock authentication by injecting API key into localStorage.
 * @param {import('@playwright/test').Page} page
 */
export async function mockAuthentication(page) {
  await page.evaluate(() => {
    localStorage.setItem('openrouter_api_key', 'test-api-key-12345');
  });
}

/**
 * Clear mock authentication.
 * @param {import('@playwright/test').Page} page
 */
export async function clearAuthentication(page) {
  await page.evaluate(() => {
    localStorage.removeItem('openrouter_api_key');
  });
}
