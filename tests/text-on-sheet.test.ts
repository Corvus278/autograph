import { DEFAULT_GEOMETRY_CORRECTION } from '@pages/Generator/config';
import { deriveGeometry } from '@pages/Generator/lib/calibrate';
import type {
  GlyphOutline,
  GlyphPathCommand,
  GlyphPoint,
  GlyphSource,
} from '@pages/Generator/lib/glyph';
import { FALLBACK_FONT_METRICS } from '@pages/Generator/lib/measure/measureFontMetrics';
import { countPageLines } from '@pages/Generator/lib/paginate/countPageLines';
import type { Page } from '@pages/Generator/lib/paginate/paginate.types';
import type { PaperFamily, PaperSheet, SheetOutline } from '@pages/Generator/lib/paper';
import { buildSheetRuling } from '@pages/Generator/lib/paper';
import type { PageGlyphs } from '@pages/Generator/lib/render';
import { renderPageToCanvas } from '@pages/Generator/lib/render';
import { buildPageRenderParams } from '@pages/Generator/model/buildPageRenderParams';
import { getPageCalibration } from '@pages/Generator/model/geometrySelectors';
import { describe, expect, it } from 'vitest';

import { NO_DISTORTION_FLAGS } from './helpers/distortion-flags';
import { createPathRecorder } from './helpers/path-recorder';
import type { SyntheticSheetParams } from './helpers/synthetic-sheet';
import {
  computeSyntheticOutline,
  computeSyntheticPerspective,
} from './helpers/synthetic-sheet';

const SHEET_WIDTH = 1600;
const SHEET_HEIGHT = 1200;
const RULING_STEP = 40;

/**
 * Лист на столе: стол виден сверху и широкой полосой справа, слева лист почти
 * касается края кадра. Стороны не параллельны краям кадра, поэтому вписанный
 * прямоугольник уже самого контура. Наклон и перспектива уводят правый низ
 * блока вниз — ровно туда, где контур ближе всего к тексту.
 */
const SYNTHETIC_PARAMS: SyntheticSheetParams = {
  width: SHEET_WIDTH,
  height: SHEET_HEIGHT,
  step: RULING_STEP,
  phase: 17,
  angle: 1,
  surface: {
    outline: {
      topLeft: { x: 30, y: 150 },
      topRight: { x: 1330, y: 170 },
      bottomRight: { x: 1360, y: 1140 },
      bottomLeft: { x: 20, y: 1120 },
    },
  },
  rulingPerspective: { convergenceX: 2e-5, convergenceY: 2e-5 },
};

const OUTLINE = computeSyntheticOutline(SYNTHETIC_PARAMS);

/**
 * Лист, собранный из эталона синтетики так же, как из результата измерения:
 * полей нет, все четыре берутся фолбэком от сторон листа.
 *
 * @param outline — контур в разлиновке; `null` — лист во весь кадр
 * @param id — идентификатор экземпляра
 * @returns экземпляр листа
 */
const buildSheet = (outline: SheetOutline | null, id: string): PaperSheet => {
  return {
    id,
    label: 'Лист на столе',
    src: `/paper/${id}.jpg`,
    width: SHEET_WIDTH,
    height: SHEET_HEIGHT,
    ruling: buildSheetRuling(
      {
        step: RULING_STEP,
        firstLinePhase: SYNTHETIC_PARAMS.phase || 0,
        skewAngle: SYNTHETIC_PARAMS.angle || 0,
        perspective: computeSyntheticPerspective(SYNTHETIC_PARAMS),
        outline,
      },
      { width: SHEET_WIDTH, height: SHEET_HEIGHT }
    ),
    lighting: null,
    texture: null,
  };
};

const SHEET = buildSheet(OUTLINE, 'on-table');

/**
 * Тот же снимок, у которого контур не сохранён: фолбэк полей отсчитывается от
 * краёв кадра.
 */
const FULL_FRAME_SHEET = buildSheet(null, 'full-frame');

const FAMILY: PaperFamily = {
  id: 'lined',
  label: 'В линейку',
  kind: 'lined',
  sheets: [SHEET, FULL_FRAME_SHEET],
};

const METRICS = FALLBACK_FONT_METRICS;
const SCALE = 2;

/**
 * Буква — строчный бокс целиком: от подъёма до низа бокса, во всю ширину.
 * Верх и низ разбиты на отрезки, чтобы сдвиг к линиям фотографии проверялся не
 * только в углах буквы.
 */
const UNITS_PER_EM = 1000;
const LETTER_ADVANCE = 500;
const EDGE_SEGMENTS = 10;
const BOX_TOP = METRICS.fontAscent * UNITS_PER_EM;
const BOX_BOTTOM = (METRICS.fontAscent - METRICS.lineHeight) * UNITS_PER_EM;

/**
 * Контур буквы-бокса в единицах шрифта, `y` растёт вверх.
 *
 * @returns команды контура
 */
const buildBoxCommands = (): GlyphPathCommand[] => {
  const commands: GlyphPathCommand[] = [{ type: 'M', x: 0, y: BOX_BOTTOM }];

  for (let index = 1; index <= EDGE_SEGMENTS; index += 1) {
    commands.push({
      type: 'L',
      x: (index * LETTER_ADVANCE) / EDGE_SEGMENTS,
      y: BOX_BOTTOM,
    });
  }

  for (let index = EDGE_SEGMENTS; index >= 0; index -= 1) {
    commands.push({ type: 'L', x: (index * LETTER_ADVANCE) / EDGE_SEGMENTS, y: BOX_TOP });
  }

  commands.push({ type: 'Z' });

  return commands;
};

const BOX: GlyphOutline = {
  char: 'м',
  commands: buildBoxCommands(),
  advanceWidth: LETTER_ADVANCE,
};

const GLYPH_SOURCE: GlyphSource = {
  unitsPerEm: UNITS_PER_EM,
  getGlyph: () => {
    return BOX;
  },
  getKerning: () => {
    return 0;
  },
};

const GLYPHS: PageGlyphs = { source: GLYPH_SOURCE, hasVariance: false };

/**
 * Точки контуров страницы, текст на которой занимает всю доступную ширину и
 * высоту: первая и последняя строки из вместимости страницы заполнены
 * буквами-боксами во всю ширину блока, между ними строки пустые.
 *
 * @param sheet — лист страницы
 * @param pageIndex — номер страницы, считая с нуля
 * @returns точки в пикселях страницы
 */
const renderBoxPoints = (sheet: PaperSheet, pageIndex: number): GlyphPoint[] => {
  const calibration = getPageCalibration(FAMILY, sheet, pageIndex);
  const geometry = deriveGeometry(calibration, METRICS, DEFAULT_GEOMETRY_CORRECTION);
  const capacity = countPageLines(calibration, geometry, METRICS, 0);
  const letterWidth = (LETTER_ADVANCE / UNITS_PER_EM) * geometry.fontSizePx;
  const fullLine = 'м'.repeat(Math.floor(geometry.blockWidth / letterWidth));
  const page: Page = {
    lines: Array.from({ length: capacity }, (_, index) => {
      const isEdgeLine = index === 0 || index === capacity - 1;

      return { text: isEdgeLine ? fullLine : '', paragraphIndex: 0 };
    }),
  };
  const params = buildPageRenderParams({
    page,
    calibration,
    sheetImage: null,
    metrics: METRICS,
    correction: DEFAULT_GEOMETRY_CORRECTION,
    inkColor: '#101010',
    fontFamily: 'Synthetic',
    flags: NO_DISTORTION_FLAGS,
    wordFrequency: 1,
    letterFrequency: 1,
    seed: 42,
    ink: { lighting: null, texture: null, seed: 7 },
    glyphs: GLYPHS,
    scale: SCALE,
  });
  const recorder = createPathRecorder();

  renderPageToCanvas(recorder.context, params);

  return recorder.polylines.flatMap((polyline) => {
    return polyline.map(({ x, y }) => {
      return { x: x / SCALE, y: y / SCALE };
    });
  });
};

/**
 * Контур отражённой фотографии, выведенный из эталона независимо от
 * `mirrorSheetRuling`: левая и правая стороны меняются местами.
 *
 * @param outline — контур исходной фотографии
 * @returns контур отражённой фотографии
 */
const mirrorOutline = ({
  topLeft,
  topRight,
  bottomRight,
  bottomLeft,
}: SheetOutline): SheetOutline => {
  return {
    topLeft: { x: SHEET_WIDTH - topRight.x, y: topRight.y },
    topRight: { x: SHEET_WIDTH - topLeft.x, y: topLeft.y },
    bottomRight: { x: SHEET_WIDTH - bottomLeft.x, y: bottomLeft.y },
    bottomLeft: { x: SHEET_WIDTH - bottomRight.x, y: bottomRight.y },
  };
};

/**
 * Лежит ли точка внутри выпуклого контура: по одну сторону от каждой его
 * стороны при обходе по часовой стрелке в кадре с осью `y` вниз.
 *
 * @param outline — контур листа
 * @param point — точка кадра
 * @returns `true` — точка внутри или на стороне
 */
const isInsideOutline = (outline: SheetOutline, { x, y }: GlyphPoint): boolean => {
  const { topLeft, topRight, bottomRight, bottomLeft } = outline;
  const corners = [topLeft, topRight, bottomRight, bottomLeft];

  return corners.every((from, index) => {
    const to = corners[(index + 1) % corners.length] || from;

    return (to.x - from.x) * (y - from.y) - (to.y - from.y) * (x - from.x) >= 0;
  });
};

/**
 * Точек в первой и последней строке заведомо больше: если контуры не дошли до
 * записи, проверка прошла бы на пустом месте.
 */
const MIN_POINTS = 400;

describe('текст на листе, снятом на столе', () => {
  it.each([
    { pageIndex: 0, outline: OUTLINE, title: 'нечётная страница — в исходном контуре' },
    {
      pageIndex: 1,
      outline: mirrorOutline(OUTLINE),
      title: 'зеркальная страница — в отражённом контуре',
    },
  ])('$title', ({ pageIndex, outline }) => {
    const points = renderBoxPoints(SHEET, pageIndex);

    expect(points.length).toBeGreaterThan(MIN_POINTS);
    expect(
      points.filter((point) => {
        return !isInsideOutline(outline, point);
      })
    ).toEqual([]);
  });

  it('контроль: зеркальная страница выходит за контур исходной фотографии', () => {
    const points = renderBoxPoints(SHEET, 1);

    expect(
      points.some((point) => {
        return !isInsideOutline(OUTLINE, point);
      })
    ).toBe(true);
  });

  it('контроль: без сохранённого контура текст заходит на стол', () => {
    const points = renderBoxPoints(FULL_FRAME_SHEET, 0);

    expect(
      points.some((point) => {
        return !isInsideOutline(OUTLINE, point);
      })
    ).toBe(true);
  });
});
