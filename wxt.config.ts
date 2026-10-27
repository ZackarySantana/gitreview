import { defineConfig } from 'wxt';

const ICONS = {
  16: 'icon/16.png',
  32: 'icon/32.png',
  48: 'icon/48.png',
  128: 'icon/128.png',
};

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifestVersion: 3,
  manifest: ({ browser }) => ({
    name: 'gitreview',
    short_name: 'gitreview',
    description: 'An enhanced GitHub pull requests page with age-based review queues and focused filters.',
    homepage_url: 'https://github.com/ZackarySantana/gitreview',
    host_permissions: ['https://api.github.com/*'],
    icons: ICONS,
    // No popup: clicking the toolbar button opens the options page.
    action: {
      default_icon: ICONS,
      default_title: 'gitreview settings',
    },
    permissions: ['storage'],
    ...(browser === 'firefox' ? {
      browser_specific_settings: {
        gecko: {
          id: 'gitreview@zackarysantana.com',
          // 140 is the first release with Firefox's built-in data consent.
          strict_min_version: '140.0',
          data_collection_permissions: {
            required: ['none'],
            optional: ['authenticationInfo', 'websiteContent'],
          },
        },
        gecko_android: {
          strict_min_version: '142.0',
        },
      },
    } : {}),
  }),
});
