import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import type { GlyphSource } from '@pages/Generator/lib/glyph';
import { createGlyphSource } from '@pages/Generator/lib/glyph';
import type { PageRenderParams, RenderWord } from '@pages/Generator/lib/render';
import { renderPageToCanvas } from '@pages/Generator/lib/render';
import { describe, expect, it } from 'vitest';

import { placeWord } from './helpers/glyph-raster';
import type { Polyline } from './helpers/ink-raster';
import { countInkComponents } from './helpers/ink-raster';
import { createPathRecorder } from './helpers/path-recorder';

/**
 * Связные шрифты пака: на них видно и разрыв соединения, и разницу контуров.
 */
const CONNECTED_FAMILIES = ['Lexa', 'Salavat', 'Capuletty'];

/**
 * Кегль отрисовки. Тот же, на котором меряет стыки растеризатор глифов:
 * соединения бывают в сотую долю em, и на мелком кегле стык занимает меньше
 * пикселя.
 */
const FONT_SIZE_PX = 240;

/**
 * Метрики-модель: подъём строчного бокса ровно в кегль, чтобы базовая линия
 * считалась в уме.
 */
const FONT_METRICS = { fontAscent: 1, lineHeight: 1.4 };
const BASELINE_Y = FONT_METRICS.fontAscent * FONT_SIZE_PX;

const NO_WORD_DISTORTION = { rotate: 0, skew: 0, translateY: 0, letters: [] };
const NO_LINE_DISTORTION = { rotate: 0, translateX: 0 };

/**
 * Seed слова: одно число на весь тест — вариативность обязана быть
 * воспроизводимой.
 */
const WORD_SEED = 4242;

/**
 * Слово, буквы которого в связных шрифтах смыкаются: по нему считаются связные
 * области чернил.
 */
const JOIN_WORD = 'зубр';

const sources = new Map<string, GlyphSource>();

/**
 * Источник контуров шрифта из `public/fonts`.
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
 * Параметры отрисовки страницы с одним словом. Отступы нулевые, искажений нет:
 * координаты контуров считаются от базовой линии в уме.
 */
const buildParams = (
  family: string,
  word: string,
  hasVariance: boolean,
  seed = WORD_SEED
): PageRenderParams => {
  const words: RenderWord[] = [{ text: word, distortion: NO_WORD_DISTORTION, seed }];

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
      bend: null,
    },
    scale: 1,
  };
};

/**
 * Отрисовывает слово полным путём страницы и отдаёт залитые контуры в пикселях
 * страницы.
 */
const renderWord = (
  family: string,
  word: string,
  hasVariance: boolean,
  seed = WORD_SEED
): Polyline[] => {
  const recorder = createPathRecorder();

  renderPageToCanvas(recorder.context, buildParams(family, word, hasVariance, seed));

  return recorder.polylines;
};

/**
 * Точки, с которых начинается каждый контур слова, если буквы взяты из шрифта
 * как есть: продвижения и кернинг те же, по которым рендерер ставит буквы.
 */
const expectedContourStarts = (family: string, word: string): number[][] => {
  const source = loadSource(family);
  const scale = FONT_SIZE_PX / source.unitsPerEm;

  return placeWord(source, word, (glyph) => {
    return [...glyph.commands];
  }).flatMap(({ commands, offsetX }) => {
    return commands.reduce<number[][]>((acc, command) => {
      if (command.type === 'M') {
        acc.push([(offsetX + command.x) * scale, BASELINE_Y - command.y * scale]);
      }

      return acc;
    }, []);
  });
};

/**
 * Те же начала контуров, но снятые с отрисованной страницы.
 */
const drawnContourStarts = (polylines: readonly Polyline[]): number[][] => {
  return polylines.reduce<number[][]>((acc, polyline) => {
    const [start] = polyline;

    if (start) {
      acc.push([start.x, start.y]);
    }

    return acc;
  }, []);
};

describe('отрисовка контурами глифов', () => {
  it('рисует буквы путями, а не текстом', () => {
    const recorder = createPathRecorder();

    renderPageToCanvas(recorder.context, buildParams('Salavat', 'зубр', true));

    expect(recorder.texts).toEqual([]);
    expect(recorder.polylines.length).toBeGreaterThan(0);
  });

  it('без контуров шрифта остаётся при обычном тексте', () => {
    const recorder = createPathRecorder();
    const params = buildParams('Salavat', 'зубр', true);

    renderPageToCanvas(recorder.context, { ...params, glyphs: null });

    expect(recorder.polylines).toEqual([]);
    expect(
      recorder.texts.map(({ text }) => {
        return text;
      })
    ).toEqual(['зубр']);
  });

  it('повторяет контуры при том же seed', () => {
    expect(renderWord('Salavat', 'зубр', true)).toEqual(
      renderWord('Salavat', 'зубр', true)
    );
  });

  it('даёт разным вхождениям одной буквы разные контуры', () => {
    const first = renderWord('Salavat', 'о', true, 11);
    const second = renderWord('Salavat', 'о', true, 12);

    expect(first.length).toBe(second.length);
    expect(first).not.toEqual(second);
  });
});

describe('переключатель вариативности', () => {
  it('при выключенном флаге рисует исходные контуры шрифта', () => {
    for (const family of CONNECTED_FAMILIES) {
      const drawn = drawnContourStarts(renderWord(family, 'зубр', false));
      const expected = expectedContourStarts(family, 'зубр');

      expect({ family, starts: drawn.length }).toEqual({
        family,
        starts: expected.length,
      });

      drawn.forEach((start, index) => {
        expect(start[0]).toBeCloseTo(expected[index]?.[0] || 0, 9);
        expect(start[1]).toBeCloseTo(expected[index]?.[1] || 0, 9);
      });
    }
  });

  it('при выключенном флаге не смотрит на seed вариативности', () => {
    expect(renderWord('Salavat', 'зубр', false, 1)).toEqual(
      renderWord('Salavat', 'зубр', false, 999_983)
    );
  });

  it('при включённом флаге контуры отходят от исходных', () => {
    expect(renderWord('Salavat', 'зубр', true)).not.toEqual(
      renderWord('Salavat', 'зубр', false)
    );
  });
});

describe('связность почерка на странице', () => {
  /**
   * Проверка идёт по числу связных областей чернил, а не по эталонному снимку:
   * разрыв соединения — это лишняя область, и увидеть её можно объективно, без
   * пересъёмки эталонов и без порога расхождения пикселей.
   */
  it('сохраняет число связных областей чернил при включённой вариативности', () => {
    const report = CONNECTED_FAMILIES.map((family) => {
      const plain = countInkComponents(renderWord(family, JOIN_WORD, false));
      const varied = countInkComponents(renderWord(family, JOIN_WORD, true));

      return {
        family,
        isSame: plain === varied,
        /**
         * Областей меньше, чем букв: иначе слово и без вариативности написано
         * вразрядку, и сравнивать в нём нечего.
         */
        isJoined: 0 < plain && plain < [...JOIN_WORD].length,
      };
    });

    expect(report).toEqual(
      CONNECTED_FAMILIES.map((family) => {
        return { family, isSame: true, isJoined: true };
      })
    );
  });
});
