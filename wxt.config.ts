import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'gitreview',
    short_name: 'gitreview',
    description: 'An enhanced GitHub pull requests page with age-based review queues and focused filters.',
    homepage_url: 'https://github.com/ZackarySantana/gitreview',
    host_permissions: ['https://api.github.com/*'],
    icons: {
      16: 'icon/16.png',
      32: 'icon/32.png',
      48: 'icon/48.png',
      128: 'icon/128.png',
    },
    permissions: ['storage'],
    web_accessible_resources: [{
      matches: ['https://github.com/*'],
      resources: ['options.html'],
    }],
  },
});
