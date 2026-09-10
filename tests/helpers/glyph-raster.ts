import type {
  GlyphOutline,
  GlyphPathCommand,
  GlyphPoint,
  GlyphSource,
} from '@pages/Generator/lib/glyph';

import type { Polyline } from './ink-raster';
import {
  cubicPoint,
  CURVE_STEPS,
  edgeBounds,
  fillMask,
  growInk,
  quadPoint,
  toEdges,
} from './ink-raster';

/**
 * Кегль растеризации в пикселях. Соединения в паке бывают в сотую долю em
 * шириной: при мелком кегле такой стык занимает меньше пикселя, и счётчик
 * компонент реагирует на округление, а не на деформацию. Крупнее — точнее, но
 * время прогона растёт квадратично по кеглю.
 */
const DEFAULT_FONT_SIZE = 240;

/**
 * Допуск смыкания в пикселях растра: чернила, разделённые зазором в этот
 * радиус, считаются сомкнутыми. Иначе счётчик реагирует на волосяные касания,
 * которые и в исходном шрифте держатся на округлении, а не на геометрии.
 */
const DEFAULT_TOLERANCE = 1;

/**
 * Глиф, поставленный на своё место в слове.
 */
export type PlacedGlyph = {
  /**
   * Команды пути в единицах шрифта.
   */
  commands: readonly GlyphPathCommand[];

  /**
   * Сдвиг глифа по горизонтали в единицах шрифта.
   */
  offsetX: number;
};

/**
 * Переводит команды пути в замкнутые ломаные в пикселях. Ось `y` разворачивается:
 * в шрифте она смотрит вверх, в растре — вниз.
 */
const toPolylines = (glyphs: readonly PlacedGlyph[], scale: number): Polyline[] => {
  const polylines: Polyline[] = [];
  let current: Polyline = [];
  let cursor: GlyphPoint = { x: 0, y: 0 };

  const closeCurrent = () => {
    if (current.length > 1) {
      polylines.push(current);
    }

    current = [];
  };

  for (const glyph of glyphs) {
    const toPixel = (x: number, y: number): GlyphPoint => {
      return { x: (x + glyph.offsetX) * scale, y: -y * scale };
    };

    for (const command of glyph.commands) {
      switch (command.type) {
        case 'M': {
          closeCurrent();
          cursor = { x: command.x, y: command.y };
          current.push(toPixel(cursor.x, cursor.y));
          break;
        }

        case 'L': {
          cursor = { x: command.x, y: command.y };
          current.push(toPixel(cursor.x, cursor.y));
          break;
        }

        case 'Q': {
          const control = { x: command.x1, y: command.y1 };
          const end = { x: command.x, y: command.y };

          for (let step = 1; step <= CURVE_STEPS; step += 1) {
            const point = quadPoint(cursor, control, end, step / CURVE_STEPS);

            current.push(toPixel(point.x, point.y));
          }

          cursor = end;
          break;
        }

        case 'C': {
          const first = { x: command.x1, y: command.y1 };
          const second = { x: command.x2, y: command.y2 };
          const end = { x: command.x, y: command.y };

          for (let step = 1; step <= CURVE_STEPS; step += 1) {
            const point = cubicPoint(cursor, first, second, end, step / CURVE_STEPS);

            current.push(toPixel(point.x, point.y));
          }

          cursor = end;
          break;
        }

        case 'Z': {
          closeCurrent();
          break;
        }

        default: {
          throw new Error(`Неизвестная команда пути: ${JSON.stringify(command)}`);
        }
      }
    }

    closeCurrent();
  }

  return polylines;
};

/**
 * Расставляет глифы слова по продвижениям и кернингу.
 *
 * @param source — источник контуров шрифта
 * @param word — слово
 * @param takeCommands — контуры очередного глифа по его описанию: исходные
 *   либо деформированные
 * @returns глифы слова со сдвигами в единицах шрифта
 */
export const placeWord = (
  source: GlyphSource,
  word: string,
  takeCommands: (glyph: GlyphOutline, index: number) => GlyphPathCommand[]
): PlacedGlyph[] => {
  const chars = [...word];
  let cursor = 0;

  return chars.reduce<PlacedGlyph[]>((acc, char, index) => {
    const glyph = source.getGlyph(char);

    if (!glyph) {
      return acc;
    }

    acc.push({ commands: takeCommands(glyph, index), offsetX: cursor });

    const nextChar = chars[index + 1];

    cursor += glyph.advanceWidth + (nextChar ? source.getKerning(char, nextChar) : 0);

    return acc;
  }, []);
};

/**
 * Соприкасаются ли чернила двух наборов глифов. Проверка бьёт точно в
 * требование «соединения между соседними буквами не разрываются»: сравнивать
 * число компонент всего слова мешают волосяные касания внутри самих букв,
 * которые к соединению отношения не имеют.
 *
 * @param first — первый набор глифов, расставленных по горизонтали
 * @param second — второй набор
 * @param unitsPerEm — единиц шрифта на em
 * @param fontSize — кегль растеризации в пикселях
 * @param tolerance — допуск смыкания в пикселях
 * @returns площадь смыкания в пикселях растра
 */
export const inkContactArea = (
  first: readonly PlacedGlyph[],
  second: readonly PlacedGlyph[],
  unitsPerEm: number,
  fontSize: number = DEFAULT_FONT_SIZE,
  tolerance: number = DEFAULT_TOLERANCE
): number => {
  const scale = fontSize / unitsPerEm;
  const firstEdges = toEdges(toPolylines(first, scale));
  const secondEdges = toEdges(toPolylines(second, scale));

  if (firstEdges.length === 0 || secondEdges.length === 0) {
    return 0;
  }

  const box = edgeBounds([...firstEdges, ...secondEdges]);
  const firstInk = growInk(fillMask(firstEdges, box), box, tolerance);
  const secondInk = fillMask(secondEdges, box);

  return secondInk.reduce<number>((acc, value, index) => {
    return value === 1 && firstInk[index] === 1 ? acc + 1 : acc;
  }, 0);
};
