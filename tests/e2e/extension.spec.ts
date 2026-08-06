import { chromium, expect, test } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const extensionPath = path.join(projectRoot, '.output/chrome-mv3');

test('groups GitHub PRs and preserves the native view', async () => {
  const context = await chromium.launchPersistentContext('', {
    headless: true,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });
  const page = await context.newPage();
  await page.route('https://github.com/acme/widgets/pulls', async (route) => {
    await route.fulfill({
      body: `<!doctype html><html><head><meta name="user-login" content="alice"></head><body>
        <div class="js-navigation-container" aria-label="Pull requests">
          <div class="js-issue-row"><a class="Link--primary" href="/acme/widgets/pull/1">Old fix</a><span class="opened-by"><relative-time datetime="2020-01-01T00:00:00Z"></relative-time><a data-hovercard-type="user">alice</a></span></div>
          <div class="js-issue-row"><a class="Link--primary" href="/acme/widgets/pull/2">New fix</a><span class="opened-by"><relative-time datetime="${new Date().toISOString()}"></relative-time><a data-hovercard-type="user">bob</a></span></div>
        </div>
      </body></html>`,
      contentType: 'text/html',
      status: 200,
    });
  });

  await page.goto('https://github.com/acme/widgets/pulls');
  const extension = page.locator('#gitreview-extension');
  await expect(extension.getByRole('heading', { name: 'Overdue' })).toBeVisible();
  await expect(extension.getByRole('heading', { name: 'New' })).toBeVisible();

  await extension.getByRole('tab', { name: 'GitHub' }).click();
  await expect(page.locator('.js-navigation-container')).toBeVisible();
  await context.close();
});
