import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * Слой отрисовки: всё, что участвует в превращении рецепта в пиксели. Именно
 * здесь не должно быть своих источников случайности — иначе снимок перестал бы
 * повторяться на том же seed.
 */
const RENDER_PATHS = [
  'src/pages/Generator/lib/render',
  'src/pages/Generator/lib/glyph',
  'src/pages/Generator/lib/ink',
  'src/pages/Generator/lib/randomize',
  'src/pages/Generator/lib/paper/sampleRulingBend.ts',
  'src/pages/Generator/model/buildPageRenderParams.ts',
  'src/pages/Generator/model/buildPageTask.ts',
  'src/pages/Generator/model/drawPage.ts',
  'src/pages/Generator/model/mirrorRenderImage.ts',
  'src/pages/Generator/model/renderPageImage.ts',
  'src/pages/Generator/model/renderPageRequest.ts',
  'src/pages/Generator/model/renderPage.worker.ts',
];

/**
 * Источники случайности и времени. Всё, что даёт разный результат при
 * одинаковом входе: seed рецепта такие вызовы не контролирует.
 */
const FORBIDDEN =
  /Math\.random|crypto\.getRandomValues|Date\.now|performance\.now|new Date\(/;

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/**
 * Все файлы исходников по пути: сам файл или дерево под каталогом.
 *
 * @param path — путь относительно корня репозитория
 * @returns абсолютные пути файлов
 */
const listSourceFiles = (path: string): string[] => {
  const absolute = join(ROOT, path);

  if (!statSync(absolute).isDirectory()) {
    return [absolute];
  }

  return readdirSync(absolute).reduce<string[]>((acc, entry) => {
    acc.push(...listSourceFiles(join(path, entry)));

    return acc;
  }, []);
};

describe('слой отрисовки без своих источников случайности', () => {
  it('не зовёт ни случайных чисел, ни часов', () => {
    const guilty = RENDER_PATHS.reduce<string[]>((acc, path) => {
      listSourceFiles(path).forEach((file) => {
        if (FORBIDDEN.test(readFileSync(file, 'utf8'))) {
          acc.push(file.slice(ROOT.length));
        }
      });

      return acc;
    }, []);

    expect(guilty).toEqual([]);
  });

  it('перечисляет непустой список файлов — иначе проверка ничего не проверяет', () => {
    const files = RENDER_PATHS.flatMap(listSourceFiles);

    expect(files.length).toBeGreaterThan(10);
  });
});
