import type { StorybookConfig } from '@storybook/react-vite';

import { STORYBOOK_VERSION_DEFINE } from './appVersion';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-a11y', '@storybook/addon-vitest'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  core: {
    disableTelemetry: true,
  },
  viteFinal: (viteConfig) => {
    return {
      ...viteConfig,
      define: { ...viteConfig.define, ...STORYBOOK_VERSION_DEFINE },
    };
  },
};

export default config;
