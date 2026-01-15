import { test, expect } from '@playwright/test';

test.describe('Spraff App', () => {
  test.describe('Login Screen', () => {
    test('shows login screen when not authenticated', async ({ page }) => {
      await page.goto('/');

      // Login screen should be visible
      await expect(page.locator('.login-screen')).toBeVisible();
      await expect(page.locator('.login-btn')).toBeVisible();
      await expect(page.locator('.login-btn')).toHaveText('Get started');

      // Voice screen should be hidden
      await expect(page.locator('.voice-screen')).toHaveClass(/hidden/);
    });

    test('shows logo and tagline', async ({ page }) => {
      await page.goto('/');

      await expect(page.locator('.logo')).toBeVisible();
      await expect(page.locator('.login-tagline')).toHaveText('Simple AI chat');
    });

    test('has about link', async ({ page }) => {
      await page.goto('/');

      const aboutLink = page.locator('.login-about');
      await expect(aboutLink).toBeVisible();
      await expect(aboutLink).toHaveAttribute('href', 'https://github.com/martinpllu/spraff');
    });
  });

  test.describe('Authenticated State', () => {
    test.beforeEach(async ({ page }) => {
      // Set up mock API key in localStorage before navigating
      await page.goto('/');
      await page.evaluate(() => {
        localStorage.setItem('openrouter_api_key', 'test-api-key');
      });
      await page.reload();
    });

    test('shows voice screen when authenticated', async ({ page }) => {
      await expect(page.locator('.voice-screen')).not.toHaveClass(/hidden/);
      await expect(page.locator('.login-screen')).toHaveClass(/hidden/);
    });

    test('shows main button in ready state', async ({ page }) => {
      const mainButton = page.locator('.main-button');
      await expect(mainButton).toBeVisible();
      await expect(mainButton).not.toHaveClass(/listening/);
      await expect(mainButton).not.toHaveClass(/processing/);

      await expect(page.locator('.status-text')).toHaveText('Ready');
    });

    test('shows hint text', async ({ page }) => {
      const hint = page.locator('.hint-text');
      await expect(hint).toBeVisible();
      await expect(hint).toContainText('Tap or');
      await expect(hint).toContainText('Space');
      await expect(hint).toContainText('to speak');
    });

    test('shows mode toggle with voice mode active by default', async ({ page }) => {
      await expect(page.locator('.mode-toggle')).toBeVisible();
      await expect(page.locator('#voiceModeBtn')).toHaveClass(/active/);
      await expect(page.locator('#textModeBtn')).not.toHaveClass(/active/);
    });
  });

  test.describe('Mode Switching', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.evaluate(() => {
        localStorage.setItem('openrouter_api_key', 'test-api-key');
      });
      await page.reload();
    });

    test('switches to text mode when clicking toggle', async ({ page }) => {
      // Click the mode toggle
      await page.locator('.mode-toggle').click();

      // Text mode should be active
      await expect(page.locator('#textModeBtn')).toHaveClass(/active/);
      await expect(page.locator('#voiceModeBtn')).not.toHaveClass(/active/);

      // Text input should be visible
      await expect(page.locator('.text-input-container')).toHaveClass(/visible/);

      // Voice screen should have text-mode class
      await expect(page.locator('.voice-screen')).toHaveClass(/text-mode/);
    });

    test('switches back to voice mode', async ({ page }) => {
      // Switch to text mode
      await page.locator('.mode-toggle').click();
      await expect(page.locator('#textModeBtn')).toHaveClass(/active/);

      // Switch back to voice mode
      await page.locator('.mode-toggle').click();
      await expect(page.locator('#voiceModeBtn')).toHaveClass(/active/);
      await expect(page.locator('.text-input-container')).not.toHaveClass(/visible/);
    });

    test('text input is functional in text mode', async ({ page }) => {
      await page.locator('.mode-toggle').click();

      const textInput = page.locator('.text-input');
      await expect(textInput).toBeVisible();
      await expect(textInput).toHaveAttribute('placeholder', 'Type your message...');

      // Type something
      await textInput.fill('Hello world');
      await expect(textInput).toHaveValue('Hello world');

      // Send button should become active
      await expect(page.locator('.text-send-btn')).toHaveClass(/active/);
    });
  });

  test.describe('Settings Menu', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.evaluate(() => {
        localStorage.setItem('openrouter_api_key', 'test-api-key');
      });
      await page.reload();
    });

    test('opens and closes settings dropdown', async ({ page }) => {
      const menuBtn = page.locator('.settings-menu-btn');
      const dropdown = page.locator('.settings-dropdown');

      // Initially closed
      await expect(dropdown).not.toHaveClass(/open/);

      // Open menu
      await menuBtn.click();
      await expect(dropdown).toHaveClass(/open/);

      // Close by clicking elsewhere
      await page.locator('body').click({ position: { x: 10, y: 10 } });
      await expect(dropdown).not.toHaveClass(/open/);
    });

    test('has all menu items', async ({ page }) => {
      await page.locator('.settings-menu-btn').click();

      await expect(page.locator('#voiceSettingsBtn')).toBeVisible();
      await expect(page.locator('#costSettingsBtn')).toBeVisible();
      await expect(page.locator('#copyChatBtn')).toBeVisible();
      await expect(page.locator('#debugBtn')).toBeVisible();
      await expect(page.locator('#aboutBtn')).toBeVisible();
      await expect(page.locator('#privacyBtn')).toBeVisible();
      await expect(page.locator('#logoutBtn')).toBeVisible();
    });
  });

  test.describe('Modals', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.evaluate(() => {
        localStorage.setItem('openrouter_api_key', 'test-api-key');
      });
      await page.reload();
    });

    test('opens and closes voice settings modal', async ({ page }) => {
      await page.locator('.settings-menu-btn').click();
      await page.locator('#voiceSettingsBtn').click();

      const modal = page.locator('#voiceModal');
      await expect(modal).not.toHaveClass(/hidden/);
      await expect(modal.locator('h3')).toHaveText('Voice Settings');

      // Close modal
      await page.locator('#modalClose').click();
      await expect(modal).toHaveClass(/hidden/);
    });

    test('opens and closes cost modal', async ({ page }) => {
      await page.locator('.settings-menu-btn').click();
      await page.locator('#costSettingsBtn').click();

      const modal = page.locator('#costModal');
      await expect(modal).not.toHaveClass(/hidden/);
      await expect(modal.locator('h3')).toHaveText('Cost');

      // Close modal
      await page.locator('#costModalClose').click();
      await expect(modal).toHaveClass(/hidden/);
    });

    test('opens and closes about modal', async ({ page }) => {
      await page.locator('.settings-menu-btn').click();
      await page.locator('#aboutBtn').click();

      const modal = page.locator('#aboutModal');
      await expect(modal).not.toHaveClass(/hidden/);
      await expect(modal.locator('h3')).toHaveText('About');

      // Should show build ID
      await expect(page.locator('#buildId')).toContainText('Build:');

      // Close modal
      await page.locator('#aboutModalClose').click();
      await expect(modal).toHaveClass(/hidden/);
    });

    test('opens and closes privacy modal', async ({ page }) => {
      await page.locator('.settings-menu-btn').click();
      await page.locator('#privacyBtn').click();

      const modal = page.locator('#privacyModal');
      await expect(modal).not.toHaveClass(/hidden/);
      await expect(modal.locator('h3')).toHaveText('Privacy Policy');

      // Close modal
      await page.locator('#privacyModalClose').click();
      await expect(modal).toHaveClass(/hidden/);
    });

    test('opens and closes debug modal', async ({ page }) => {
      await page.locator('.settings-menu-btn').click();
      await page.locator('#debugBtn').click();

      const modal = page.locator('#debugModal');
      await expect(modal).not.toHaveClass(/hidden/);
      await expect(modal.locator('h3')).toHaveText('Debug Console');

      // Should have debug content area
      await expect(page.locator('#debugContent')).toBeVisible();

      // Close modal
      await page.locator('#debugModalClose').click();
      await expect(modal).toHaveClass(/hidden/);
    });

    test('closes modal when clicking overlay', async ({ page }) => {
      await page.locator('.settings-menu-btn').click();
      await page.locator('#aboutBtn').click();

      const modal = page.locator('#aboutModal');
      await expect(modal).not.toHaveClass(/hidden/);

      // Click on the overlay (outside the modal content)
      await modal.click({ position: { x: 10, y: 10 } });
      await expect(modal).toHaveClass(/hidden/);
    });
  });

  test.describe('Logout', () => {
    test('clears credentials and shows login screen', async ({ page }) => {
      await page.goto('/');
      await page.evaluate(() => {
        localStorage.setItem('openrouter_api_key', 'test-api-key');
        localStorage.setItem('conversationHistory', '[]');
      });
      await page.reload();

      // Verify we're authenticated
      await expect(page.locator('.voice-screen')).not.toHaveClass(/hidden/);

      // Click logout
      await page.locator('.settings-menu-btn').click();
      await page.locator('#logoutBtn').click();

      // Should show login screen
      await expect(page.locator('.login-screen')).not.toHaveClass(/hidden/);
      await expect(page.locator('.voice-screen')).toHaveClass(/hidden/);

      // localStorage should be cleared
      const apiKey = await page.evaluate(() => localStorage.getItem('openrouter_api_key'));
      expect(apiKey).toBeNull();
    });
  });

  test.describe('Conversation History', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.evaluate(() => {
        localStorage.setItem('openrouter_api_key', 'test-api-key');
        localStorage.setItem(
          'conversationHistory',
          JSON.stringify([
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Hi there!' },
          ])
        );
      });
      await page.reload();
    });

    test('shows clear button with message count when history exists', async ({ page }) => {
      const clearBtn = page.locator('#clearChatBtn');
      await expect(clearBtn).toBeVisible();

      const badge = page.locator('#clearChatBadge');
      await expect(badge).toHaveText('1'); // 1 user message
    });

    test('renders conversation in text mode', async ({ page }) => {
      // Switch to text mode
      await page.locator('.mode-toggle').click();

      // Conversation history should be visible
      await expect(page.locator('.conversation-history')).toHaveClass(/visible/);
    });

    test('clear button requires confirmation', async ({ page }) => {
      const clearBtn = page.locator('#clearChatBtn');

      // First click - should show confirmation
      await clearBtn.click();
      await expect(clearBtn).toHaveClass(/confirming/);
      await expect(clearBtn.locator('.clear-chat-text')).toHaveText('Clear?');

      // Click elsewhere to cancel
      await page.locator('body').click({ position: { x: 10, y: 10 } });
      await expect(clearBtn).not.toHaveClass(/confirming/);
      await expect(clearBtn.locator('.clear-chat-text')).toHaveText('Clear');
    });

    test('clear button clears history on double click', async ({ page }) => {
      const clearBtn = page.locator('#clearChatBtn');

      // Double click to confirm
      await clearBtn.click();
      await clearBtn.click();

      // Button should be hidden after clearing
      await expect(clearBtn).toHaveClass(/hidden/);

      // localStorage should be cleared
      const history = await page.evaluate(() => localStorage.getItem('conversationHistory'));
      expect(history).toBeNull();
    });
  });
});
