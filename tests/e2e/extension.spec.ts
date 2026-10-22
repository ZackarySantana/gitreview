import { chromium, expect, test, type BrowserContext } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const extensionPath = path.join(projectRoot, '.output/chrome-mv3');

async function launchWithPage(body: string): Promise<BrowserContext> {
  const context = await chromium.launchPersistentContext('', {
    headless: true,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });
  await context.route('https://github.com/acme/widgets/pulls', async (route) => {
    await route.fulfill({
      body: `<!doctype html><html><head><meta name="user-login" content="alice"></head><body>${body}</body></html>`,
      contentType: 'text/html',
      status: 200,
    });
  });
  return context;
}

function refreshedRow(number: number, title: string, openedAt: string): string {
  return `<li><a data-testid="listitem-title-link" href="https://github.com/acme/widgets/pull/${number}">${title}</a><span data-testid="timestamp-container"><a data-testid="author-filter-link">alice</a> opened <relative-time datetime="${openedAt}"></relative-time></span></li>`;
}

test('groups classic GitHub PRs and preserves the native view', async () => {
  const context = await launchWithPage(`
    <div class="js-navigation-container" aria-label="Pull requests">
      <div class="js-issue-row"><a class="Link--primary" href="/acme/widgets/pull/1">Old fix</a><span class="opened-by"><relative-time datetime="2020-01-01T00:00:00Z"></relative-time><a data-hovercard-type="user">alice</a></span></div>
      <div class="js-issue-row"><a class="Link--primary" href="/acme/widgets/pull/2">New fix</a><span class="opened-by"><relative-time datetime="${new Date().toISOString()}"></relative-time><a data-hovercard-type="user">bob</a></span></div>
    </div>
  `);
  const page = await context.newPage();

  await page.goto('https://github.com/acme/widgets/pulls');
  const extension = page.locator('#gitreview-extension');
  await expect(extension.getByRole('heading', { name: 'Overdue' })).toBeVisible();
  await expect(extension.getByRole('heading', { name: 'New' })).toBeVisible();

  await extension.getByRole('tab', { name: 'GitHub' }).click();
  await expect(page.locator('.js-navigation-container')).toBeVisible();
  await context.close();
});

test('groups refreshed GitHub PRs and keeps the view when the list is replaced', async () => {
  const context = await launchWithPage(`
    <react-app app-name="pull-requests"><div id="list-parent">
      <ul data-listview-component="items-list" role="list">
        ${refreshedRow(1, 'Old fix', '2020-01-01T00:00:00Z')}
        ${refreshedRow(2, 'New fix', new Date().toISOString())}
      </ul>
    </div></react-app>
  `);
  const page = await context.newPage();

  await page.goto('https://github.com/acme/widgets/pulls');
  const extension = page.locator('#gitreview-extension');
  const nativeList = page.locator('ul[data-listview-component="items-list"]');
  await expect(extension.getByRole('heading', { name: 'Overdue' })).toBeVisible();
  await expect(extension.getByRole('heading', { name: 'New' })).toBeVisible();
  await expect(nativeList).toBeHidden();

  await page.evaluate((row) => {
    const list = document.createElement('ul');
    list.dataset.listviewComponent = 'items-list';
    list.innerHTML = row;
    document.querySelector('ul[data-listview-component="items-list"]')?.replaceWith(list);
  }, refreshedRow(3, 'Replaced fix', new Date().toISOString()));
  await expect(extension.getByText('Replaced fix')).toBeVisible();
  await expect(nativeList).toBeHidden();

  await extension.getByRole('tab', { name: 'GitHub' }).click();
  await expect(nativeList).toBeVisible();
  await context.close();
});
