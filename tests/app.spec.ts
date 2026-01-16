import { test, expect } from '@playwright/test';

test.describe('Spraff App', () => {
  test.describe('Login Screen', () => {
    test('shows login screen when not authenticated', async ({ page }) => {
      await page.goto('/');

      // Login screen should be visible
      await expect(page.locator('.login-screen')).toBeVisible();
      await expect(page.locator('.login-btn')).toBeVisible();
      await expect(page.locator('.login-btn')).toHaveText('Get started');

      // Voice screen should not exist when not authenticated
      await expect(page.locator('.voice-screen')).not.toBeVisible();
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
      await expect(page.locator('.voice-screen')).toBeVisible();
      await expect(page.locator('.login-screen')).not.toBeVisible();
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
      // Voice mode button (first button) should be active
      await expect(page.locator('.mode-toggle .mode-btn').first()).toHaveClass(/active/);
      // Text mode button (second button) should not be active
      await expect(page.locator('.mode-toggle .mode-btn').nth(1)).not.toHaveClass(/active/);
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

      // Text mode should be active (second button)
      await expect(page.locator('.mode-toggle .mode-btn').nth(1)).toHaveClass(/active/);
      await expect(page.locator('.mode-toggle .mode-btn').first()).not.toHaveClass(/active/);

      // Text input should be visible
      await expect(page.locator('.text-input-container')).toHaveClass(/visible/);
    });

    test('switches back to voice mode', async ({ page }) => {
      // Switch to text mode
      await page.locator('.mode-toggle').click();
      await expect(page.locator('.mode-toggle .mode-btn').nth(1)).toHaveClass(/active/);

      // Switch back to voice mode
      await page.locator('.mode-toggle').click();
      await expect(page.locator('.mode-toggle .mode-btn').first()).toHaveClass(/active/);
      await expect(page.locator('.text-input-container')).not.toBeVisible();
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

      // Initially not visible
      await expect(dropdown).not.toBeVisible();

      // Open menu
      await menuBtn.click();
      await expect(dropdown).toBeVisible();

      // Close by clicking elsewhere
      await page.locator('body').click({ position: { x: 10, y: 10 } });
      await expect(dropdown).not.toBeVisible();
    });

    test('has all menu items', async ({ page }) => {
      await page.locator('.settings-menu-btn').click();

      // Check for menu items by text content
      await expect(page.locator('.settings-dropdown button:has-text("Voice")')).toBeVisible();
      await expect(page.locator('.settings-dropdown button:has-text("Cost")')).toBeVisible();
      await expect(page.locator('.settings-dropdown button:has-text("Copy chat")')).toBeVisible();
      await expect(page.locator('.settings-dropdown button:has-text("Debug")')).toBeVisible();
      await expect(page.locator('.settings-dropdown button:has-text("About")')).toBeVisible();
      await expect(page.locator('.settings-dropdown button:has-text("Privacy")')).toBeVisible();
      await expect(page.locator('.settings-dropdown button:has-text("Logout")')).toBeVisible();
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
      await page.locator('.settings-dropdown button:has-text("Voice")').click();

      const modal = page.locator('.modal-overlay:has(.modal-header h3:text("Voice Settings"))');
      await expect(modal).toBeVisible();
      await expect(modal.locator('h3')).toHaveText('Voice Settings');

      // Close modal
      await modal.locator('.modal-close').click();
      await expect(modal).not.toBeVisible();
    });

    test('opens and closes cost modal', async ({ page }) => {
      await page.locator('.settings-menu-btn').click();
      await page.locator('.settings-dropdown button:has-text("Cost")').click();

      const modal = page.locator('.modal-overlay:has(.modal-header h3:text("Cost"))');
      await expect(modal).toBeVisible();
      await expect(modal.locator('h3')).toHaveText('Cost');

      // Close modal
      await modal.locator('.modal-close').click();
      await expect(modal).not.toBeVisible();
    });

    test('opens and closes about modal', async ({ page }) => {
      await page.locator('.settings-menu-btn').click();
      await page.locator('.settings-dropdown button:has-text("About")').click();

      const modal = page.locator('.modal-overlay:has(.modal-header h3:text("About"))');
      await expect(modal).toBeVisible();
      await expect(modal.locator('h3')).toHaveText('About');

      // Should show build ID
      await expect(modal.locator('text=/Build:/')).toBeVisible();

      // Close modal
      await modal.locator('.modal-close').click();
      await expect(modal).not.toBeVisible();
    });

    test('opens and closes privacy modal', async ({ page }) => {
      await page.locator('.settings-menu-btn').click();
      await page.locator('.settings-dropdown button:has-text("Privacy")').click();

      const modal = page.locator('.modal-overlay:has(.modal-header h3:text("Privacy Policy"))');
      await expect(modal).toBeVisible();
      await expect(modal.locator('h3')).toHaveText('Privacy Policy');

      // Close modal
      await modal.locator('.modal-close').click();
      await expect(modal).not.toBeVisible();
    });

    test('opens and closes debug modal', async ({ page }) => {
      await page.locator('.settings-menu-btn').click();
      await page.locator('.settings-dropdown button:has-text("Debug")').click();

      const modal = page.locator('.modal-overlay:has(.modal-header h3:text("Debug Console"))');
      await expect(modal).toBeVisible();
      await expect(modal.locator('h3')).toHaveText('Debug Console');

      // Should have debug content area
      await expect(modal.locator('.debug-content')).toBeVisible();

      // Close modal
      await modal.locator('.modal-close').click();
      await expect(modal).not.toBeVisible();
    });

    test('closes modal when clicking overlay', async ({ page }) => {
      await page.locator('.settings-menu-btn').click();
      await page.locator('.settings-dropdown button:has-text("About")').click();

      const modal = page.locator('.modal-overlay:has(.modal-header h3:text("About"))');
      await expect(modal).toBeVisible();

      // Click on the overlay (outside the modal content)
      await modal.click({ position: { x: 10, y: 10 } });
      await expect(modal).not.toBeVisible();
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
      await expect(page.locator('.voice-screen')).toBeVisible();

      // Click logout
      await page.locator('.settings-menu-btn').click();
      await page.locator('.settings-dropdown button:has-text("Logout")').click();

      // Should show login screen
      await expect(page.locator('.login-screen')).toBeVisible();
      await expect(page.locator('.voice-screen')).not.toBeVisible();

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

    test('renders conversation in text mode', async ({ page }) => {
      // Switch to text mode
      await page.locator('.mode-toggle').click();

      // Conversation history should be visible
      await expect(page.locator('.conversation-history')).toBeVisible();
    });

    test('shows chat title in text mode', async ({ page }) => {
      // Switch to text mode
      await page.locator('.mode-toggle').click();

      // Chat title header should be visible
      await expect(page.locator('.chat-title-header')).toBeVisible();
    });

    test('shows sidebar toggle button', async ({ page }) => {
      // Sidebar toggle button should be visible
      await expect(page.locator('.sidebar-toggle-btn')).toBeVisible();
    });
  });
});
