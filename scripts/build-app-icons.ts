import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { chromium } from 'playwright';

/**
 * Скрипт сборки иконок приложения: растеризует `public/favicon.svg` в PNG для
 * веб-манифеста (решение D5 в `openspec/changes/offline-pwa/design.md`).
 * Результат коммитится, в рантайме и в сборке ничего не растеризуется.
 *
 * Запуск — `npm run build:icons`. Результат: `public/icon-192.png`,
 * `public/icon-512.png`, `public/icon-maskable-512.png`.
 */

/**
 * Корень проекта. Берётся из рабочего каталога, а не из пути файла: скрипт
 * запускается собранным в кэш сборки, и его собственный путь ничего не говорит
 * о расположении репозитория.
 */
const ROOT = process.cwd();

/**
 * Доля холста под рисунок в `maskable`-варианте: маска Android срезает углы, и
 * скруглённый прямоугольник исходника после среза выглядел бы обкусанным.
 */
const SAFE_ZONE = 0.8;

/**
 * Цвет фона `maskable`-варианта, если в исходнике не нашлось заливки подложки.
 * Совпадает с заливкой её прямоугольника в `favicon.svg`.
 */
const FALLBACK_BACKGROUND = '#f4f1e8';

/**
 * Иконка манифеста: имя файла, сторона квадрата и признак варианта под маску.
 */
type IconSpec = {
  /**
   * Имя файла в `public`.
   */
  file: string;

  /**
   * Сторона квадратного холста в пикселях.
   */
  size: number;

  /**
   * Вариант под маску: фон во весь квадрат, рисунок ужат в безопасную зону.
   */
  isMaskable: boolean;
};

/**
 * Задание на растеризацию, уходящее в браузер.
 */
type RenderInput = {
  /**
   * Разметка svg в base64: строку проще перенести через границу, чем файл.
   */
  svg: string;

  /**
   * Сторона квадратного холста в пикселях.
   */
  size: number;

  /**
   * Доля холста под рисунок.
   */
  scale: number;

  /**
   * Заливка всего квадрата под рисунком; пустая строка — фона нет.
   */
  background: string;
};

/**
 * Состав манифеста: две иконки общего назначения и одна под маску (контракт K1
 * прогона `offline-pwa`).
 */
const ICONS: IconSpec[] = [
  { file: 'icon-192.png', size: 192, isMaskable: false },
  { file: 'icon-512.png', size: 512, isMaskable: false },
  { file: 'icon-maskable-512.png', size: 512, isMaskable: true },
];

/**
 * Задаёт svg собственный размер: без атрибутов `width` и `height` изображение
 * с одним `viewBox` растеризуется в браузере по умолчанию 300×150, и рисунок
 * приходит в холст мыльным.
 */
const withIntrinsicSize = (markup: string, size: number): string => {
  return markup.replace('<svg', `<svg width="${size}" height="${size}"`);
};

/**
 * Достаёт заливку подложки — первого прямоугольника исходника: у обеих иконок
 * фон обязан совпасть, а держать цвет в двух местах значит однажды их развести.
 */
const readBackground = (markup: string): string => {
  const rect = /<rect[^>]*\bfill="([^"]+)"/.exec(markup);

  return rect?.[1] || FALLBACK_BACKGROUND;
};

/**
 * Пересобирает иконки приложения из `public/favicon.svg`.
 */
const main = async (): Promise<void> => {
  const source = readFileSync(join(ROOT, 'public', 'favicon.svg'), 'utf8');
  const background = readBackground(source);
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    for (const { file, size, isMaskable } of ICONS) {
      const input: RenderInput = {
        svg: Buffer.from(withIntrinsicSize(source, size), 'utf8').toString('base64'),
        size,
        scale: isMaskable ? SAFE_ZONE : 1,
        background: isMaskable ? background : '',
      };
      const dataUrl = await page.evaluate(async (task: RenderInput) => {
        const image = new Image();

        image.src = `data:image/svg+xml;base64,${task.svg}`;
        await image.decode();

        const canvas = document.createElement('canvas');

        canvas.width = task.size;
        canvas.height = task.size;

        const context = canvas.getContext('2d');

        if (!context) {
          throw new Error('Канва для растеризации иконки недоступна');
        }

        if (task.background) {
          context.fillStyle = task.background;
          context.fillRect(0, 0, task.size, task.size);
        }

        const drawn = task.size * task.scale;
        const offset = (task.size - drawn) / 2;

        context.drawImage(image, offset, offset, drawn, drawn);

        return canvas.toDataURL('image/png');
      }, input);

      const path = join(ROOT, 'public', file);

      writeFileSync(path, Buffer.from(dataUrl.split(',')[1] || '', 'base64'));
      console.error(`${file}: ${size}×${size}${isMaskable ? `, фон ${background}` : ''}`);
    }
  } finally {
    await browser.close();
  }
};

await main();
