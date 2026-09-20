import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  buildForPrecache,
  cleanupPrecacheBuilds,
  CONTROL_PROBE_FILE,
  OVERSIZED_PROBE_FILE,
  type PrecacheBuild,
  prepareProbePublicDir,
  readBuiltFileSizes,
  readMaxPrecachedFileSize,
} from './helpers/pwa-build';

/**
 * Полнота precache: всё, что лежит в сборке, обязано попасть в
 * precache-манифест `sw.js`. Иначе добавленный лист, шрифт или сцена молча
 * выпадут из оффлайна — список расширений в `globPatterns` устареет, а
 * приложение об этом не скажет.
 *
 * Тест собирает проект сам, а не читает готовый `dist`: на чистом дереве
 * `dist` нет, и проверка «читаем, если есть» была бы зелёной всегда.
 */

/**
 * Базы, под которые собирается проект: корень (dev, тесты, Storybook) и
 * подпапка GitHub Pages. Список precache обязан совпадать с содержимым сборки
 * при обеих — префикс базы в адресах появляется только во второй.
 */
const BASES = ['/', '/autograph/'];

/**
 * Имена каталогов сборки по базе: у каждой базы своя копия.
 */
const BUILD_NAMES: Record<string, string> = {
  '/': 'root-base',
  '/autograph/': 'sub-base',
};

/**
 * Иконки веб-манифеста по контракту K1.
 */
const EXPECTED_ICONS = [
  { file: 'icon-192.png', sizes: '192x192', purpose: undefined },
  { file: 'icon-512.png', sizes: '512x512', purpose: undefined },
  { file: 'icon-maskable-512.png', sizes: '512x512', purpose: 'maskable' },
];

/**
 * Вызов очистки устаревших кэшей в собранном `sw.js`. Проверяется вызов, а не
 * имя опции: `cleanupOutdatedCaches` в конфиге — настройка Workbox, а удаляет
 * кэши прошлых версий именно этот вызов в service worker. Без имени модуля
 * перед ним: минификатор переименовывает переменную пространства имён
 * workbox, а имя самого метода оставляет.
 */
const CLEANUP_OUTDATED_CACHES_CALL = /\bcleanupOutdatedCaches\(\)/;

/**
 * Сборка проекта идёт секундами, а не миллисекундами, и таких сборок три.
 */
const BUILD_TIMEOUT = 180_000;

/**
 * Иконка веб-манифеста.
 */
type ManifestIcon = {
  /**
   * Адрес файла.
   */
  src: string;
  /**
   * Размеры вида `512x512`.
   */
  sizes: string;
  /**
   * MIME-тип файла.
   */
  type: string;
  /**
   * Назначение: `maskable` у иконки под маску Android.
   */
  purpose?: string;
};

/**
 * Поля веб-манифеста, которые сторожит тест.
 */
type WebManifest = {
  /**
   * Область действия приложения.
   */
  scope: string;
  /**
   * Адрес запуска установленного приложения.
   */
  start_url: string;
  /**
   * Иконки приложения.
   */
  icons: ManifestIcon[];
};

const builds = new Map<string, PrecacheBuild>();

/**
 * Сборка под базу. Отдельной функцией, чтобы отсутствие сборки роняло тест, а
 * не превращало его в проверку `undefined`.
 *
 * @param base — базовый путь
 * @returns разобранная сборка
 */
const requireBuild = (base: string): PrecacheBuild => {
  const build = builds.get(base);

  if (!build) {
    throw new Error(`сборка под базу ${base} не готова`);
  }

  return build;
};

/**
 * Читает веб-манифест сборки.
 *
 * @param outDir — каталог сборки
 * @returns разобранный манифест
 */
const readWebManifest = async (outDir: string): Promise<WebManifest> => {
  const source = await readFile(path.join(outDir, 'manifest.webmanifest'), 'utf8');

  return JSON.parse(source) as WebManifest;
};

beforeAll(async () => {
  /**
   * Сборки идут одна за другой: база приходит в конфиг переменной окружения,
   * и параллельные сборки перетёрли бы её друг другу.
   */
  for (const base of BASES) {
    const name = BUILD_NAMES[base];

    if (!name) {
      throw new Error(`не задан каталог сборки под базу ${base}`);
    }

    builds.set(base, await buildForPrecache({ base, name }));
  }
}, BUILD_TIMEOUT);

afterAll(async () => {
  await cleanupPrecacheBuilds();
});

describe.each(BASES)('сборка с базой %s', (base) => {
  it('кладёт в precache ровно файлы сборки', () => {
    const { files, precachePaths } = requireBuild(base);
    const expectedPaths = files.map((file) => {
      return `${base}${file}`;
    });

    expect([...precachePaths].sort()).toEqual([...expectedPaths].sort());
  });

  it('кладёт в precache все листы, текстуры, профили, шрифты и сцены', () => {
    const { files, precachePaths } = requireBuild(base);
    const assets = files.filter((file) => {
      return (
        file.startsWith('paper/') || file.startsWith('fonts/') || file.endsWith('.jpg')
      );
    });

    expect(assets.length).toBeGreaterThan(0);

    for (const asset of assets) {
      expect(precachePaths).toContain(`${base}${asset}`);
    }
  });

  it('ведёт навигационный фолбэк на index.html от базового пути', async () => {
    const { outDir } = requireBuild(base);
    const source = await readFile(path.join(outDir, 'sw.js'), 'utf8');

    expect(source).toContain(`createHandlerBoundToURL("${base}index.html")`);
  });

  it('чистит кэш предыдущих версий', async () => {
    const { outDir } = requireBuild(base);
    const source = await readFile(path.join(outDir, 'sw.js'), 'utf8');

    expect(source).toMatch(CLEANUP_OUTDATED_CACHES_CALL);
  });

  it('описывает в манифесте три иконки от базового пути', async () => {
    const { outDir, files, precachePaths } = requireBuild(base);
    const manifest = await readWebManifest(outDir);

    expect(manifest.scope).toBe(base);
    expect(manifest.start_url).toBe(base);
    expect(manifest.icons).toHaveLength(EXPECTED_ICONS.length);

    for (const [index, expected] of EXPECTED_ICONS.entries()) {
      const icon = manifest.icons[index];

      expect(icon).toMatchObject({
        src: `${base}${expected.file}`,
        sizes: expected.sizes,
        type: 'image/png',
      });
      expect(icon?.purpose).toBe(expected.purpose);
      expect(files).toContain(expected.file);
      expect(precachePaths).toContain(`${base}${expected.file}`);
    }
  });

  it('держит все файлы сборки в пределах порога precache', async () => {
    const { outDir, files } = requireBuild(base);
    const maxFileSize = await readMaxPrecachedFileSize();

    /**
     * Порог читается из конфига сборки: неразобранное значение сравнением
     * «больше NaN» пропустило бы любой файл и сделало проверку пустой.
     */
    expect(maxFileSize).toBeGreaterThan(0);

    const sizes = await readBuiltFileSizes(outDir, files);
    const oversized = sizes.filter(({ size }) => {
      return size > maxFileSize;
    });

    expect(oversized).toEqual([]);
  });
});

describe('порог размера файла precache', () => {
  /**
   * Файлу крупнее порога закрыты оба тихих исхода: либо сборка падает сама,
   * либо он выпадает из precache — и тогда падает сверка полноты. Проба
   * собирается с подменённым каталогом статики, чтобы крупный файл не оседал
   * в `public`, если тест прервётся посередине.
   */
  it(
    'не даёт файлу крупнее порога тихо выпасть из precache',
    async () => {
      const maxFileSize = await readMaxPrecachedFileSize();
      const publicDir = await prepareProbePublicDir(maxFileSize);

      let probe: PrecacheBuild | undefined;
      let buildError: unknown;

      try {
        probe = await buildForPrecache({ base: '/', name: 'oversized-base', publicDir });
      } catch (error) {
        buildError = error;
      }

      if (!probe) {
        expect(String(buildError)).toContain(OVERSIZED_PROBE_FILE);

        return;
      }

      const { files, precachePaths } = probe;

      /**
       * Контрольный файл того же расширения отделяет причину «крупный» от
       * причины «расширение не попало в `globPatterns`».
       */
      expect(files).toContain(CONTROL_PROBE_FILE);
      expect(precachePaths).toContain(`/${CONTROL_PROBE_FILE}`);

      expect(files).toContain(OVERSIZED_PROBE_FILE);
      expect(precachePaths).not.toContain(`/${OVERSIZED_PROBE_FILE}`);

      const expectedPaths = files.map((file) => {
        return `/${file}`;
      });

      expect(() => {
        expect([...precachePaths].sort()).toEqual([...expectedPaths].sort());
      }).toThrow();
    },
    BUILD_TIMEOUT
  );
});
