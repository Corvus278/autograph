import process from 'node:process';
import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import browserslistToEsbuild from 'browserslist-to-esbuild';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Базовый путь задаёт деплой: GitHub Pages раздаёт проект из `/<репозиторий>/`,
 * а dev-сервер, тесты и Storybook работают от корня.
 *
 * Плагин PWA сам подставляет его в `scope`, `start_url` и адреса service worker,
 * но не в `src` иконок манифеста — их приходится собирать вручную.
 */
const basePath = process.env.BASE_PATH || '/';

/**
 * Файл крупнее порога выпадает из precache молча, поэтому порог задан явно:
 * тест полноты precache читает его отсюда и сверяет с размерами файлов `dist`.
 */
const MAX_PRECACHED_FILE_SIZE = 2 * 1024 * 1024;

/**
 * Крупные зависимости, которые нужны экрану сразу и потому не откладываются
 * динамическим импортом. Каждая уезжает в свой чанк: одним куском приложение
 * переваливало за порог предупреждения сборки, а браузер разбирал весь код
 * генератора до первого кадра.
 *
 * Ключ — имя чанка, значение — начало пути внутри `node_modules`. Порядок
 * важен: `react-router` не должен попасть в чанк `react` по совпадению
 * префикса, поэтому пути проверяются с завершающим слешем.
 */
const VENDOR_CHUNKS = [
  { name: 'react', packages: ['react/', 'react-dom/', 'scheduler/', 'react-router/'] },
  { name: 'radix', packages: ['@radix-ui/'] },
  { name: 'opentype', packages: ['opentype.js/'] },
];

/**
 * Чанк вендорной зависимости по пути модуля. Свой код приложения и всё
 * остальное из `node_modules` остаются в общем чанке: дробить их по пакетам
 * значило бы менять состав сборки при каждой правке зависимостей.
 */
const splitVendorChunk = (id: string): string | undefined => {
  if (!id.includes('node_modules')) {
    return undefined;
  }

  return VENDOR_CHUNKS.find(({ packages }) => {
    return packages.some((packagePath) => {
      return id.includes(`node_modules/${packagePath}`);
    });
  })?.name;
};

export default defineConfig({
  base: basePath,
  publicDir: 'public',
  plugins: [
    react({
      babel: {
        plugins: ['babel-plugin-react-compiler'],
      },
    }),
    tailwindcss(),
    VitePWA({
      // Плашка, а не тихая перезагрузка: `autoUpdate` перезагрузил бы вкладку посреди набора
      // текста, а каретку и прокрутку листа сессия в `localStorage` не переживает.
      registerType: 'prompt',
      // Регистрацию ведёт приложение (`src/app/model/serviceWorkerRegistration.ts`) под
      // `import.meta.env.PROD`: скрипт от плагина зарегистрировал бы service worker и в
      // статическом Storybook, который собирается тем же production-билдом Vite.
      injectRegister: null,
      // Значение по умолчанию, записанное явно: dev-сервер, Storybook и тесты идут без
      // service worker, иначе правки не доходят до экрана без ручной очистки кэша.
      devOptions: {
        enabled: false,
      },
      // Иконки манифеста плагин кладёт в precache отдельной пачкой, разыскивая их в `public` по
      // `src` без базового пути: при `BASE_PATH=/autograph/` он их не находит, а при пустой базе
      // добавляет вторыми экземплярами поверх `globPatterns`. `globPatterns` берёт их в обоих
      // случаях, поэтому список precache остаётся одним и тем же при любой базе.
      includeManifestIcons: false,
      manifest: {
        name: 'Autograph — генератор рукописного текста',
        short_name: 'Autograph',
        description:
          'Генератор рукописного текста: текст, рукописный шрифт и фотография листа — на выходе страницы в JPEG.',
        lang: 'ru',
        display: 'standalone',
        theme_color: '#15171b',
        background_color: '#15171b',
        icons: [
          {
            src: `${basePath}icon-192.png`,
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: `${basePath}icon-512.png`,
            sizes: '512x512',
            type: 'image/png',
          },
          {
            // Маска Android срезает углы, поэтому у этой иконки рисунок ужат в центральные 80 %.
            src: `${basePath}icon-maskable-512.png`,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Дефолт Workbox молча пропустил бы `.jpg`, `.ttf` и `profiles.json` — то есть ровно то,
        // без чего оффлайн-генератор превращается в пустой лист. Список повторяет расширения,
        // которые реально лежат в `dist`; его полноту сторожит тест полноты precache.
        globPatterns: ['**/*.{js,css,html,json,svg,png,jpg,ttf,webmanifest}'],
        // Сам манифест плагин кладёт в precache отдельной записью, поэтому из выборки по
        // `globPatterns` он исключается: иначе один и тот же адрес попадает в список дважды.
        globIgnores: ['**/node_modules/**/*', 'manifest.webmanifest'],
        // Workbox пишет адреса precache относительно `sw.js`; резолвятся они верно, но проверить
        // базу в собранном списке было бы нечем. Префикс делает адреса абсолютными от базы.
        modifyURLPrefix: { '': basePath },
        maximumFileSizeToCacheInBytes: MAX_PRECACHED_FILE_SIZE,
        cleanupOutdatedCaches: true,
        // SPA: маршруты `/`, `/create-font` и неизвестные адреса обслуживает один документ.
        // Адрес — с базой: `modifyURLPrefix` правит только список precache, а этот адрес идёт
        // в `sw.js` как записан, и относительный не совпал бы с ключом precache при чтении глазами.
        navigateFallback: `${basePath}index.html`,
      },
    }),
  ],
  resolve: {
    alias: {
      '@app': fileURLToPath(new URL('./src/app', import.meta.url)),
      '@pages': fileURLToPath(new URL('./src/pages', import.meta.url)),
      '@shared': fileURLToPath(new URL('./src/shared', import.meta.url)),
      '@widgets': fileURLToPath(new URL('./src/widgets', import.meta.url)),
    },
  },
  server: {
    host: true,
    port: 5173,
  },
  preview: {
    host: true,
    port: 4173,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Единственный источник правды о поддержке — `.browserslistrc`;
    // Vite его сам не читает, поэтому переводим запросы в esbuild-таргеты.
    target: browserslistToEsbuild(),
    rollupOptions: {
      output: {
        manualChunks: splitVendorChunk,
      },
    },
  },
});
