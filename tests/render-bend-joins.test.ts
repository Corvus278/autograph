import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import type { GlyphSource } from '@pages/Generator/lib/glyph';
import { createGlyphSource } from '@pages/Generator/lib/glyph';
import type { RulingBend } from '@pages/Generator/lib/paper';
import { sampleRulingBend } from '@pages/Generator/lib/paper';
import type { PageRenderParams, RenderWord } from '@pages/Generator/lib/render';
import { renderPageToCanvas } from '@pages/Generator/lib/render';
import { describe, expect, it } from 'vitest';

import { placeWord } from './helpers/glyph-raster';
import type { Polyline } from './helpers/ink-raster';
import { countInkComponents } from './helpers/ink-raster';
import { createPathRecorder } from './helpers/path-recorder';

/**
 * Связные шрифты пака: на них виден разрыв соединения.
 */
const CONNECTED_FAMILIES = ['Lexa', 'Salavat', 'Capuletty'];

/**
 * Кегль отрисовки: на мелком кегле стык занимает меньше пикселя.
 */
const FONT_SIZE_PX = 240;
const FONT_METRICS = { fontAscent: 1, lineHeight: 1.4 };
const BASELINE_Y = FONT_METRICS.fontAscent * FONT_SIZE_PX;

const NO_WORD_DISTORTION = { rotate: 0, skew: 0, translateY: 0, letters: [] };
const NO_LINE_DISTORTION = { rotate: 0, translateX: 0 };
const WORD_SEED = 4242;

/**
 * Слово, буквы которого в связных шрифтах смыкаются.
 */
const JOIN_WORD = 'зубр';

/**
 * Изгиб — наклонная прямая с лёгкой кривизной под словом: перепад на ширине
 * буквы — десятки пикселей, больше толщины штриха, поэтому буквы, сдвинутые
 * каждая целиком, разошлись бы на стыках. Узлы раздвинуты за края слова: у
 * крайних узлов касательная сплайна нулевая.
 */
const BEND_SLOPE = 0.6;
const BEND_CURVATURE = 0.0004;
const BEND_CENTER_X = 250;
const BEND_COLUMN_ORIGIN = -300;
const BEND_COLUMN_SPACING = 50;
const BEND_COLUMN_COUNT = 23;

/**
 * Перепад изгиба на ширине самой узкой буквы должен превышать толщину штриха
 * с запасом: средняя толщина занижает толщину стыков.
 */
const STROKE_MARGIN = 1.5;

/**
 * Узлы изгиба по формуле прямой с кривизной; строки узлов одинаковые, и изгиб
 * от высоты не зависит.
 *
 * @returns сетка изгиба
 */
const buildBend = (): RulingBend => {
  const row = Array.from({ length: BEND_COLUMN_COUNT }, (_, index) => {
    const offsetX = BEND_COLUMN_ORIGIN + index * BEND_COLUMN_SPACING - BEND_CENTER_X;

    return Math.round((BEND_SLOPE * offsetX + BEND_CURVATURE * offsetX ** 2) * 100) / 100;
  });

  return {
    columnOrigin: BEND_COLUMN_ORIGIN,
    columnSpacing: BEND_COLUMN_SPACING,
    columnCount: BEND_COLUMN_COUNT,
    rowOrigin: 0,
    rowSpacing: 1000,
    rowCount: 2,
    offsets: [...row, ...row],
  };
};

const BEND = buildBend();

/**
 * Лист теста без наклона и без перспективы: строки узлов идут по вертикали
 * кадра.
 */
const BEND_PROJECTION = { skewAngle: 0, perspective: null };

const sources = new Map<string, GlyphSource>();

/**
 * Источник контуров шрифта из `public/fonts`.
 *
 * @param family — семейство шрифта
 * @returns разобранный шрифт
 */
const loadSource = (family: string): GlyphSource => {
  const cached = sources.get(family);

  if (cached) {
    return cached;
  }

  const path = fileURLToPath(new URL(`../public/fonts/${family}.ttf`, import.meta.url));
  const source = createGlyphSource(new Uint8Array(readFileSync(path)).buffer);

  sources.set(family, source);

  return source;
};

/**
 * Параметры страницы с одним словом без отступов и без неровности почерка.
 *
 * @param family — семейство шрифта
 * @param bend — изгиб листа или `null` для ровного
 * @param hasVariance — включена ли вариативность контуров
 * @returns параметры отрисовки
 */
const buildParams = (
  family: string,
  bend: RulingBend | null,
  hasVariance: boolean
): PageRenderParams => {
  const words: RenderWord[] = [
    { text: JOIN_WORD, distortion: NO_WORD_DISTORTION, seed: WORD_SEED },
  ];

  return {
    page: { lines: [{ words, distortion: NO_LINE_DISTORTION }] },
    background: null,
    inkColor: '#101010',
    ink: { lighting: null, texture: null, seed: 1 },
    glyphs: { source: loadSource(family), hasVariance },
    fontFamily: family,
    geometry: {
      fontSizePx: FONT_SIZE_PX,
      lineSpacing: 0,
      topOffset: 0,
      leftPadding: 0,
      blockWidth: 0,
      blockRotate: 0,
      fontMetrics: FONT_METRICS,
      bend,
    },
    scale: 1,
  };
};

/**
 * Отрисовывает слово и отдаёт залитые контуры в пикселях страницы.
 *
 * @param family — семейство шрифта
 * @param bend — изгиб листа или `null`
 * @param hasVariance — включена ли вариативность
 * @returns контуры слова
 */
const renderWord = (
  family: string,
  bend: RulingBend | null,
  hasVariance: boolean
): Polyline[] => {
  const recorder = createPathRecorder();

  renderPageToCanvas(recorder.context, buildParams(family, bend, hasVariance));

  return recorder.polylines;
};

/**
 * Средняя толщина штриха: у тонкой длинной фигуры площадь — длина на толщину,
 * а периметр — две длины.
 *
 * @param polylines — замкнутые контуры в пикселях
 * @returns толщина в пикселях
 */
const measureStrokeWidth = (polylines: readonly Polyline[]): number => {
  const totals = polylines.reduce(
    (acc, polyline) => {
      polyline.forEach((point, index) => {
        const next = polyline[(index + 1) % polyline.length] || point;

        acc.area += (point.x * next.y - next.x * point.y) / 2;
        acc.perimeter += Math.hypot(next.x - point.x, next.y - point.y);
      });

      return acc;
    },
    { area: 0, perimeter: 0 }
  );

  return (2 * Math.abs(totals.area)) / (totals.perimeter || 1);
};

/**
 * Наименьший перепад изгиба между левым и правым краем буквы слова на базовой
 * линии.
 *
 * @param family — семейство шрифта
 * @returns перепад в пикселях
 */
const measureMinLetterBendDrop = (family: string): number => {
  const source = loadSource(family);
  const scale = FONT_SIZE_PX / source.unitsPerEm;
  const placed = placeWord(source, JOIN_WORD, (glyph) => {
    return [...glyph.commands];
  });

  return Math.min(
    ...placed.map(({ offsetX }, index) => {
      const left = offsetX * scale;
      const nextOffset = placed[index + 1]?.offsetX;
      const advance = source.getGlyph([...JOIN_WORD][index] || '')?.advanceWidth || 0;
      const right = (nextOffset === undefined ? offsetX + advance : nextOffset) * scale;

      return Math.abs(
        sampleRulingBend(BEND, BEND_PROJECTION, right, BASELINE_Y) -
          sampleRulingBend(BEND, BEND_PROJECTION, left, BASELINE_Y)
      );
    })
  );
};

describe('связность почерка на изогнутом листе', () => {
  it('сохраняет число связных областей чернил, как на ровном листе', () => {
    const report = CONNECTED_FAMILIES.map((family) => {
      const flat = renderWord(family, null, true);
      const bent = countInkComponents(renderWord(family, BEND, true));
      const flatCount = countInkComponents(flat);

      return {
        family,
        isSame: bent === flatCount,
        /**
         * Областей меньше, чем букв: слово связное, и разрыв стыка было бы видно.
         */
        isJoined: 0 < flatCount && flatCount < [...JOIN_WORD].length,
        /**
         * Перепад изгиба на букве больше толщины штриха: буква, сдвинутая
         * целиком, разошлась бы с соседней на стыке.
         */
        isBendSteep:
          measureMinLetterBendDrop(family) >
          STROKE_MARGIN * measureStrokeWidth(renderWord(family, null, false)),
      };
    });

    expect(report).toEqual(
      CONNECTED_FAMILIES.map((family) => {
        return { family, isSame: true, isJoined: true, isBendSteep: true };
      })
    );
  });
});
