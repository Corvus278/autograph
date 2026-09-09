import { fileURLToPath } from 'node:url';

import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

/**
 * Снимки упавших скриншотных тестов (`actual` и `diff`) — рядом с эталонами, а
 * не в корне репозитория: каталог по умолчанию (`.vitest-attachments`) лежит
 * там же, где `package.json`, и мозолит глаза. Настройку приходится повторять
 * в каждом проекте — корневую проекты не наследуют.
 */
const ATTACHMENTS_DIR = 'tests/visual/.attachments';

const alias = {
  '@app': fileURLToPath(new URL('./src/app', import.meta.url)),
  '@pages': fileURLToPath(new URL('./src/pages', import.meta.url)),
  '@shared': fileURLToPath(new URL('./src/shared', import.meta.url)),
};

export default defineConfig({
  test: {
    projects: [
      {
        plugins: [react()],
        resolve: { alias },
        test: {
          name: 'unit',
          attachmentsDir: ATTACHMENTS_DIR,
          include: ['tests/**/*.test.{ts,tsx}'],
          setupFiles: ['tests/helpers/jsdom-setup.ts'],
          // Окружение по умолчанию — node; компонентные тесты просят jsdom
          // директивой `@vitest-environment jsdom` в шапке файла.
          environment: 'node',
        },
      },
      {
        plugins: [react(), tailwindcss(), storybookTest({ configDir: '.storybook' })],
        resolve: { alias },
        test: {
          name: 'storybook',
          attachmentsDir: ATTACHMENTS_DIR,
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
      {
        /**
         * Те же stories, но со снимком экрана после каждой. Отдельным проектом,
         * чтобы обычный прогон stories не требовал эталонов, а скриншотный не
         * зависел от того, где его запустили: эталоны снимаются и сверяются
         * только в docker-образе Playwright.
         */
        plugins: [react(), tailwindcss(), storybookTest({ configDir: '.storybook' })],
        resolve: { alias },
        test: {
          name: 'visual',
          attachmentsDir: ATTACHMENTS_DIR,
          setupFiles: ['.storybook/visual-setup.ts'],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }],
            expect: {
              toMatchScreenshot: {
                comparatorName: 'pixelmatch',
                /**
                 * Допуск маленький: снимок — целое окно предпросмотра, и
                 * процент от него скрыл бы сдвиг отступа у отдельного
                 * контрола. Эталон и прогон идут в одном docker-образе,
                 * поэтому разброс сглаживания почти нулевой.
                 */
                comparatorOptions: { allowedMismatchedPixelRatio: 0.0002 },
                /**
                 * Все эталоны — в одной папке репозитория, а не россыпью
                 * `__screenshots__` рядом со stories: подпапка называется по
                 * компоненту, файл — по story. Платформа в имени обязательна:
                 * прогон вне linux-образа не должен молча сверяться с
                 * эталонами, снятыми в docker.
                 */
                resolveScreenshotPath: ({
                  root,
                  testFileName,
                  arg,
                  browserName,
                  platform,
                  ext,
                }) => {
                  const component = testFileName.replace('.stories.tsx', '');

                  return `${root}/tests/visual/__screenshots__/${component}/${arg}_${browserName}-${platform}${ext}`;
                },
              },
            },
          },
        },
      },
    ],
  },
});
