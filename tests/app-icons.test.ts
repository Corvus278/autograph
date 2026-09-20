import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';

import { describe, expect, it } from 'vitest';

/**
 * Иконки приложения для веб-манифеста: `public/icon-*.png`, собираются
 * `npm run build:icons` из `public/favicon.svg` и коммитятся.
 *
 * Проверка идёт по самим файлам, а не по выводу скрипта: в репозитории лежат
 * готовые PNG, и разойтись с манифестом может именно закоммиченный файл —
 * пересобранный руками в другом размере или без альфы.
 */

/**
 * Подпись PNG: первые восемь байт файла.
 */
const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

/**
 * Тип цвета IHDR для RGBA с восемью битами на канал. Иконки пишутся канвой
 * Chromium, и другого варианта у неё не бывает.
 */
const RGBA_COLOR_TYPE = 6;

/**
 * Байт на пиксель в RGBA.
 */
const BYTES_PER_PIXEL = 4;

/**
 * Доля холста под рисунок в `maskable`-варианте: маска Android срезает углы,
 * и всё за этой долей обязано быть фоном.
 */
const SAFE_ZONE = 0.8;

/**
 * Разобранная картинка PNG.
 */
type PngImage = {
  /**
   * Ширина в пикселях из IHDR.
   */
  width: number;

  /**
   * Высота в пикселях из IHDR.
   */
  height: number;

  /**
   * Тип цвета из IHDR.
   */
  colorType: number;

  /**
   * Глубина канала в битах из IHDR.
   */
  bitDepth: number;

  /**
   * Пиксели RGBA построчно, без фильтров.
   */
  data: Uint8Array;
};

/**
 * Предсказатель Пейса из спецификации PNG (фильтр строки 4).
 */
const paeth = (left: number, up: number, upLeft: number): number => {
  const estimate = left + up - upLeft;
  const toLeft = Math.abs(estimate - left);
  const toUp = Math.abs(estimate - up);
  const toUpLeft = Math.abs(estimate - upLeft);

  if (toLeft <= toUp && toLeft <= toUpLeft) {
    return left;
  }

  return toUp <= toUpLeft ? up : upLeft;
};

/**
 * Поправка байта по типу фильтра строки.
 */
const restoreByte = (
  filter: number,
  left: number,
  up: number,
  upLeft: number
): number => {
  switch (filter) {
    case 0: {
      return 0;
    }

    case 1: {
      return left;
    }

    case 2: {
      return up;
    }

    case 3: {
      return Math.floor((left + up) / 2);
    }

    case 4: {
      return paeth(left, up, upLeft);
    }

    default: {
      throw new Error(`Неизвестный фильтр строки PNG: ${filter}`);
    }
  }
};

/**
 * Снимает фильтры строк с распакованных данных IDAT.
 */
const unfilter = (raw: Buffer, width: number, height: number): Uint8Array => {
  const stride = width * BYTES_PER_PIXEL;
  const data = new Uint8Array(stride * height);

  for (let row = 0; row < height; row += 1) {
    const rowStart = row * (stride + 1);
    const filter = raw[rowStart] || 0;
    const target = row * stride;

    for (let index = 0; index < stride; index += 1) {
      const left =
        index >= BYTES_PER_PIXEL ? data[target + index - BYTES_PER_PIXEL] || 0 : 0;
      const up = row > 0 ? data[target - stride + index] || 0 : 0;
      const upLeft =
        row > 0 && index >= BYTES_PER_PIXEL
          ? data[target - stride + index - BYTES_PER_PIXEL] || 0
          : 0;

      data[target + index] =
        ((raw[rowStart + 1 + index] || 0) + restoreByte(filter, left, up, upLeft)) & 0xff;
    }
  }

  return data;
};

/**
 * Разбирает PNG: заголовок IHDR и пиксели RGBA. Поддержан ровно тот формат,
 * который пишет канва Chromium, — RGBA по восемь бит без чересстрочности;
 * всё прочее роняет разбор, а не читается наугад.
 */
const decodePng = (path: string): PngImage => {
  const file = readFileSync(path);

  expect([...file.subarray(0, 8)]).toEqual(PNG_SIGNATURE);

  let header: Omit<PngImage, 'data'> | null = null;
  const parts: Buffer[] = [];
  let offset = 8;

  while (offset + 8 <= file.length) {
    const length = file.readUInt32BE(offset);
    const type = file.toString('ascii', offset + 4, offset + 8);
    const body = file.subarray(offset + 8, offset + 8 + length);

    switch (type) {
      case 'IHDR': {
        header = {
          width: body.readUInt32BE(0),
          height: body.readUInt32BE(4),
          bitDepth: body.readUInt8(8),
          colorType: body.readUInt8(9),
        };

        expect(body.readUInt8(12)).toBe(0);
        break;
      }

      case 'IDAT': {
        parts.push(body);
        break;
      }

      default: {
        break;
      }
    }

    offset += length + 12;
  }

  if (!header) {
    throw new Error(`В файле ${path} нет заголовка IHDR`);
  }

  expect(header.bitDepth).toBe(8);
  expect(header.colorType).toBe(RGBA_COLOR_TYPE);

  return {
    ...header,
    data: unfilter(inflateSync(Buffer.concat(parts)), header.width, header.height),
  };
};

/**
 * Пиксель RGBA в виде четырёх чисел.
 */
const pixelAt = (image: PngImage, x: number, y: number): number[] => {
  const start = (y * image.width + x) * BYTES_PER_PIXEL;

  return [...image.data.subarray(start, start + BYTES_PER_PIXEL)];
};

/**
 * Путь к иконке в `public`.
 */
const iconPath = (file: string): string => {
  return fileURLToPath(new URL(`../public/${file}`, import.meta.url));
};

describe('иконки приложения', () => {
  it('иконка 192 — квадрат 192 с альфой', () => {
    const image = decodePng(iconPath('icon-192.png'));

    expect([image.width, image.height]).toEqual([192, 192]);
  });

  it('иконка 512 — квадрат 512 с альфой', () => {
    const image = decodePng(iconPath('icon-512.png'));

    expect([image.width, image.height]).toEqual([512, 512]);
  });

  it('обычная иконка рисуется во весь холст: угол остаётся прозрачным', () => {
    const image = decodePng(iconPath('icon-512.png'));

    expect(pixelAt(image, 0, 0)[3]).toBe(0);
  });

  it('maskable-иконка — квадрат 512 с фоном во весь холст', () => {
    const image = decodePng(iconPath('icon-maskable-512.png'));

    expect([image.width, image.height]).toEqual([512, 512]);

    const background = pixelAt(image, 0, 0);

    expect(background[3]).toBe(255);
  });

  it('рисунок maskable-иконки не касается краёв', () => {
    const image = decodePng(iconPath('icon-maskable-512.png'));
    const background = pixelAt(image, 0, 0);

    /**
     * Полоса чуть уже безопасной зоны: у её границы рисунок сглажен, и
     * последний пиксель контура честно отличается от фона.
     */
    const band = Math.floor((image.width * (1 - SAFE_ZONE)) / 2) - 3;
    const outside: string[] = [];

    for (let y = 0; y < image.height; y += 1) {
      for (let x = 0; x < image.width; x += 1) {
        const isInsideBand =
          x >= band && y >= band && x < image.width - band && y < image.height - band;

        if (isInsideBand) {
          continue;
        }

        if (pixelAt(image, x, y).join() !== background.join()) {
          outside.push(`${x},${y}`);
        }
      }
    }

    expect(outside.slice(0, 5)).toEqual([]);
  });

  it('в центре maskable-иконки есть рисунок, а не один фон', () => {
    const image = decodePng(iconPath('icon-maskable-512.png'));
    const background = pixelAt(image, 0, 0).join();
    const middle = Math.floor(image.height / 2);
    const painted: number[] = [];

    for (let x = 0; x < image.width; x += 1) {
      if (pixelAt(image, x, middle).join() !== background) {
        painted.push(x);
      }
    }

    expect(painted.length).toBeGreaterThan(image.width / 4);
  });
});
