import { cp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { build } from 'vite';

/**
 * Корень репозитория: хелпер лежит в `tests/helpers`.
 */
export const PROJECT_ROOT = fileURLToPath(new URL('../../', import.meta.url));

/**
 * Каталог под сборки проверки precache. Внутри `node_modules/.cache`, а не в
 * `dist`: тест собирает проект сам и не должен затирать сборку, которую
 * разработчик держит под `npm run preview`.
 */
const BUILD_CACHE_DIR = path.join(PROJECT_ROOT, 'node_modules/.cache/pwa-precache');

/**
 * Происхождение, от которого резолвятся адреса precache. Своё имя, а не
 * `localhost`: адреса сравниваются по пути, происхождение в сравнение не
 * входит и не должно совпасть со случайным адресом из окружения.
 */
const PRECACHE_ORIGIN = 'http://precache.test';

/**
 * Вне precache по устройству раздачи: сам `sw.js`, его рантайм workbox и
 * `404.html` — копия `index.html`, которую workflow Pages кладёт уже после
 * `vite build`.
 */
const NON_PRECACHED_FILE = /^(?:sw\.js|workbox-[^/]+\.js|404\.html)$/;

/**
 * Запись precache-манифеста в собранном `sw.js`. Кавычки у ключей и пробелы
 * необязательны: минифицированный `sw.js` пишет литерал без них, а
 * неминифицированный — с ними.
 */
const PRECACHE_ENTRY =
  /\{\s*"?url"?\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"?revision"?\s*:\s*(?:null|"[^"]*")\s*\}/g;

/**
 * Имя пробного файла, который заведомо крупнее порога precache.
 */
export const OVERSIZED_PROBE_FILE = 'oversized-precache-probe.json';

/**
 * Имя контрольного файла того же расширения и заведомо мелкого: он обязан
 * попасть в precache и отделяет причину «крупный» от причины «расширение не
 * попало в `globPatterns`».
 */
export const CONTROL_PROBE_FILE = 'control-precache-probe.json';

/**
 * Собранная копия проекта, разобранная до того, что сверяет тест.
 */
export type PrecacheBuild = {
  /**
   * Базовый путь сборки: тот, что ушёл в `BASE_PATH`. Всегда со слешом на
   * конце.
   */
  base: string;
  /**
   * Каталог сборки.
   */
  outDir: string;
  /**
   * Файлы сборки путями от `outDir`, без тех, что в precache не попадают по
   * устройству раздачи.
   */
  files: string[];
  /**
   * Адреса precache, приведённые к пути от корня сайта резолвом от
   * `<base>sw.js`.
   */
  precachePaths: string[];
};

/**
 * Параметры сборки под проверку precache.
 */
type BuildOptions = {
  /**
   * Базовый путь со слешом на конце: `/` или `/autograph/`.
   */
  base: string;
  /**
   * Имя подкаталога сборки — чтобы сборки под разные базы не затирали друг
   * друга.
   */
  name: string;
  /**
   * Каталог статики вместо `public`. Нужен пробе на порог размера: класть
   * пробный файл в сам `public` значит оставить его в репозитории, если тест
   * упадёт посередине.
   */
  publicDir?: string;
};

/**
 * Считает арифметику вида `2 * 1024 * 1024` без `eval`: порог в
 * `vite.config.ts` записан произведением, а импортировать его оттуда нельзя —
 * конфиг экспортирует только сам объект конфигурации.
 *
 * @param expression — выражение из сложений и умножений целых чисел
 * @returns значение выражения
 */
const evaluateNumericExpression = (expression: string): number => {
  return expression.split('+').reduce((sum, term) => {
    return (
      sum +
      term.split('*').reduce((product, factor) => {
        const value = Number(factor.trim());

        if (!Number.isFinite(value)) {
          throw new Error(`порог precache не разбирается как число: ${expression}`);
        }

        return product * value;
      }, 1)
    );
  }, 0);
};

/**
 * Возвращает `maximumFileSizeToCacheInBytes` из конфига сборки: порог берётся
 * из единственного места, где он задан, иначе тест сторожил бы свою копию
 * числа, а не настройку.
 *
 * @returns порог в байтах
 */
export const readMaxPrecachedFileSize = async (): Promise<number> => {
  const source = await readFile(path.join(PROJECT_ROOT, 'vite.config.ts'), 'utf8');
  const option = source.match(/maximumFileSizeToCacheInBytes:\s*([^,\n]+)/);
  const rawValue = option?.[1]?.trim();

  if (!rawValue) {
    throw new Error('в vite.config.ts не найден maximumFileSizeToCacheInBytes');
  }

  if (!/^[A-Z][A-Z\d_]*$/.test(rawValue)) {
    return evaluateNumericExpression(rawValue);
  }

  const declaration = source.match(new RegExp(`const ${rawValue} = ([^;]+);`));
  const expression = declaration?.[1];

  if (!expression) {
    throw new Error(`в vite.config.ts не найдено объявление ${rawValue}`);
  }

  return evaluateNumericExpression(expression);
};

/**
 * Возвращает переменную окружения в прежнее состояние: сборки идут одна за
 * другой в одном процессе, и забытое значение досталось бы следующей.
 *
 * @param name — имя переменной
 * @param previous — значение до сборки, `undefined` — переменной не было
 */
const restoreEnv = (name: string, previous: string | undefined): void => {
  if (previous === undefined) {
    delete process.env[name];

    return;
  }

  process.env[name] = previous;
};

/**
 * Файлы сборки, от которых ждут попадания в precache.
 *
 * @param outDir — каталог сборки
 * @returns пути от `outDir` через `/`
 */
const listPrecachableFiles = async (outDir: string): Promise<string[]> => {
  const entries = await readdir(outDir, { recursive: true, withFileTypes: true });

  return entries.reduce<string[]>((acc, entry) => {
    if (!entry.isFile()) {
      return acc;
    }

    const relativePath = path
      .relative(outDir, path.join(entry.parentPath, entry.name))
      .split(path.sep)
      .join('/');

    if (!NON_PRECACHED_FILE.test(relativePath)) {
      acc.push(relativePath);
    }

    return acc;
  }, []);
};

/**
 * Адреса precache из собранного `sw.js`, приведённые к пути от корня сайта.
 *
 * Резолв идёт от `<base>sw.js`, а не проверкой префикса базы: один адрес —
 * `manifest.webmanifest` — плагин кладёт отдельной записью уже после
 * `modifyURLPrefix` и оставляет относительным. Браузер читает его так же, и
 * сверка по префиксу падала бы на верной сборке.
 *
 * @param outDir — каталог сборки
 * @param base — базовый путь сборки
 * @returns пути от корня сайта в порядке записи в манифесте
 */
const readPrecachePaths = async (outDir: string, base: string): Promise<string[]> => {
  const source = await readFile(path.join(outDir, 'sw.js'), 'utf8');
  const serviceWorkerUrl = `${PRECACHE_ORIGIN}${base}sw.js`;

  return [...source.matchAll(PRECACHE_ENTRY)].reduce<string[]>((acc, match) => {
    const [, url] = match;

    if (url) {
      acc.push(new URL(url, serviceWorkerUrl).pathname);
    }

    return acc;
  }, []);
};

/**
 * Собирает проект в отдельный каталог и разбирает его precache-манифест.
 *
 * Сборка своя, а не чтение готового `dist`: на чистом дереве `dist` нет, и
 * тест, который его пропускает, зелен всегда.
 *
 * @param options — база, имя каталога и подмена `public`
 * @returns разобранная сборка
 */
export const buildForPrecache = async ({
  base,
  name,
  publicDir,
}: BuildOptions): Promise<PrecacheBuild> => {
  const outDir = path.join(BUILD_CACHE_DIR, name);
  const previousBase = process.env.BASE_PATH;
  const previousNodeEnv = process.env.NODE_ENV;

  /**
   * База задаётся переменной окружения, а не полем `base` в вызове: конфиг
   * собирает из неё ещё и адреса иконок манифеста, `modifyURLPrefix` и
   * `navigateFallback`, и подмена одного `base` их бы рассинхронизировала.
   */
  process.env.BASE_PATH = base;

  /**
   * Под vitest `NODE_ENV` — `test`, а плагин PWA передаёт его Workbox режимом
   * сборки: сверялся бы не production-`sw.js`, а отладочный, с другим
   * списком и другими размерами файлов.
   */
  process.env.NODE_ENV = 'production';

  try {
    await build({
      configFile: path.join(PROJECT_ROOT, 'vite.config.ts'),
      root: PROJECT_ROOT,
      logLevel: 'error',
      build: { outDir, emptyOutDir: true },
      ...(publicDir === undefined ? {} : { publicDir }),
    });
  } finally {
    restoreEnv('BASE_PATH', previousBase);
    restoreEnv('NODE_ENV', previousNodeEnv);
  }

  return {
    base,
    outDir,
    files: await listPrecachableFiles(outDir),
    precachePaths: await readPrecachePaths(outDir, base),
  };
};

/**
 * Готовит копию `public` с двумя пробными файлами одного расширения: одним
 * крупнее порога precache и одним заведомо мелким.
 *
 * @param oversizedBytes — порог precache в байтах; пробный файл выходит крупнее
 * @returns путь к подготовленному каталогу статики
 */
export const prepareProbePublicDir = async (oversizedBytes: number): Promise<string> => {
  const publicDir = path.join(BUILD_CACHE_DIR, 'public-probe');

  await rm(publicDir, { recursive: true, force: true });
  await cp(path.join(PROJECT_ROOT, 'public'), publicDir, { recursive: true });
  await writeFile(
    path.join(publicDir, OVERSIZED_PROBE_FILE),
    `"${'x'.repeat(oversizedBytes)}"`
  );
  await writeFile(path.join(publicDir, CONTROL_PROBE_FILE), '"probe"');

  return publicDir;
};

/**
 * Размер одного файла сборки.
 */
export type BuiltFileSize = {
  /**
   * Путь от каталога сборки через `/`.
   */
  file: string;
  /**
   * Размер в байтах.
   */
  size: number;
};

/**
 * Размеры файлов сборки.
 *
 * @param outDir — каталог сборки
 * @param files — пути от `outDir`
 * @returns пары «путь — размер в байтах»
 */
export const readBuiltFileSizes = async (
  outDir: string,
  files: string[]
): Promise<BuiltFileSize[]> => {
  return Promise.all(
    files.map(async (file) => {
      const { size } = await stat(path.join(outDir, file));

      return { file, size };
    })
  );
};

/**
 * Убирает за собой сборки проверки: три копии `dist` и копия `public` — это
 * десятки мегабайт в кэше.
 */
export const cleanupPrecacheBuilds = async (): Promise<void> => {
  await rm(BUILD_CACHE_DIR, { recursive: true, force: true });
};
