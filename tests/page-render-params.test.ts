import { DEFAULT_GEOMETRY_CORRECTION } from '@pages/Generator/config';
import { PAGE_IMAGE_MIME } from '@pages/Generator/lib/export';
import { FALLBACK_FONT_METRICS } from '@pages/Generator/lib/measure/measureFontMetrics';
import type { Page } from '@pages/Generator/lib/paginate/paginate.types';
import type { PaperFamily, PaperSheet } from '@pages/Generator/lib/paper';
import type { RenderImage } from '@pages/Generator/lib/render';
import { renderPageToCanvas } from '@pages/Generator/lib/render';
import {
  buildPageRenderParams,
  isMirroredPage,
} from '@pages/Generator/model/buildPageRenderParams';
import { mirrorRenderImage } from '@pages/Generator/model/mirrorRenderImage';
import type { PageRenderInput } from '@pages/Generator/model/pageRender.types';
import { renderPageImage } from '@pages/Generator/model/renderPageImage';
import { describe, expect, it } from 'vitest';

import {
  createDrawRecorder,
  createSurfaceRecorder,
  findCalls,
} from './helpers/canvas-recorder';
import { NO_DISTORTION_FLAGS } from './helpers/distortion-flags';

/**
 * Лист-модель: линия поля стоит на известном месте, поля и ширина подобраны так,
 * чтобы геометрия считалась в уме.
 */
const MARGIN_LINE_X = 25;
const PAGE_WIDTH = 200;
const PAGE_HEIGHT = 400;
const RULING_STEP = 40;

/**
 * Зазор между линией поля и началом текста — пятая часть шага разлиновки; та же
 * доля, что и в автокалибровке.
 */
const MARGIN_LINE_GAP = RULING_STEP * 0.2;

/**
 * Наклон экземпляра: ни на что другое в геометрии он не похож, поэтому по нему
 * сразу видно, дошёл ли угол до отрисовки.
 */
const SKEW_ANGLE = 1.7;

const SHEET: PaperSheet = {
  id: 'sheet-1',
  label: 'Лист 1',
  src: '/paper/sheet-1.jpg',
  width: 400,
  height: 800,
  skewAngle: SKEW_ANGLE,
  measuredStep: RULING_STEP,
  normalizeScale: 1,
  firstLinePhase: 100,
  lighting: null,
  texture: null,
};

const FAMILY: PaperFamily = {
  id: 'lined',
  label: 'В линейку',
  width: PAGE_WIDTH,
  height: PAGE_HEIGHT,
  ruling: {
    kind: 'lined',
    step: RULING_STEP,
    firstLineOffset: 100,
    margins: { top: 100, right: 100, bottom: 0, left: 0 },
    marginLineX: MARGIN_LINE_X,
  },
  sheets: [SHEET],
};

const PAGE: Page = {
  lines: [
    { text: 'раз два', paragraphIndex: 0 },
    { text: '', paragraphIndex: 0 },
    { text: 'три', paragraphIndex: 1 },
  ],
};

/**
 * Изображение-пустышка: рендерер только передаёт его в контекст, а тест
 * сравнивает по ссылке.
 */
const SHEET_IMAGE = { id: 'sheet-image' } as unknown as RenderImage;

const buildInput = (patch: Partial<PageRenderInput> = {}): PageRenderInput => {
  return {
    page: PAGE,
    family: FAMILY,
    sheet: SHEET,
    sheetImage: SHEET_IMAGE,
    metrics: FALLBACK_FONT_METRICS,
    correction: DEFAULT_GEOMETRY_CORRECTION,
    isMirrored: false,
    inkColor: '#123456',
    fontFamily: 'Eskal',
    flags: NO_DISTORTION_FLAGS,
    wordFrequency: 1,
    letterFrequency: 1,
    seed: 42,
    ink: { lighting: null, texture: null, seed: 7 },
    glyphs: null,
    scale: 1,
    ...patch,
  };
};

describe('адаптер параметров отрисовки', () => {
  it('переводит раскладку в слова и строки страницы', () => {
    const { page } = buildPageRenderParams(buildInput());

    expect(page.lines).toHaveLength(3);
    expect(
      page.lines[0]?.words.map((word) => {
        return word.text;
      })
    ).toEqual(['раз', 'два']);
    expect(page.lines[1]?.words).toEqual([]);
  });

  it('берёт кегль и ширину блока из разлиновки семьи', () => {
    const { geometry } = buildPageRenderParams(buildInput());

    expect(geometry.fontSizePx).toBeCloseTo(
      (RULING_STEP * 0.55) / FALLBACK_FONT_METRICS.xHeight
    );
    expect(geometry.leftPadding).toBeCloseTo(MARGIN_LINE_X + MARGIN_LINE_GAP);
    expect(geometry.blockWidth).toBeCloseTo(
      PAGE_WIDTH - MARGIN_LINE_X - MARGIN_LINE_GAP - 100
    );
  });

  it('кладёт фотографию экземпляра масштабом нормировки, а не по размеру страницы', () => {
    const { background } = buildPageRenderParams(buildInput());

    /**
     * Фотография вдвое крупнее страницы, но её шаг разлиновки уже равен
     * каноническому: нормировка — единица, и растягивать фотографию по
     * странице значило бы дать ей свой шаг. Лишнее обрезает страница.
     */
    expect(background).toEqual({
      image: SHEET_IMAGE,
      x: 0,
      y: 0,
      width: SHEET.width,
      height: SHEET.height,
    });
  });

  it('садит первую линию фотографии на первую линию канона', () => {
    const shifted: PaperSheet = { ...SHEET, firstLinePhase: 130 };
    const { background } = buildPageRenderParams(buildInput({ sheet: shifted }));

    /**
     * Фаза больше канонического отступа: фотография поднимается, и её первая
     * линия садится на каноническую.
     */
    expect(background?.y).toBeCloseTo(FAMILY.ruling.firstLineOffset - 130);
  });

  it('оставляет одни чернила, когда экземпляра нет', () => {
    const { background } = buildPageRenderParams(buildInput({ sheet: null }));

    expect(background).toBeNull();
  });

  it('оставляет одни чернила, когда фотографии нет', () => {
    const { background } = buildPageRenderParams(buildInput({ sheetImage: null }));

    expect(background).toBeNull();
  });

  it('наклоняет блок на угол экземпляра', () => {
    const { geometry } = buildPageRenderParams(buildInput());

    expect(geometry.blockRotate).toBe(SKEW_ANGLE);
  });
});

describe('чётные страницы', () => {
  it('считает чётной вторую страницу пользовательской нумерации', () => {
    expect(isMirroredPage(0)).toBe(false);
    expect(isMirroredPage(1)).toBe(true);
    expect(isMirroredPage(2)).toBe(false);
  });

  it('отступает от отражённой линии поля на ту же величину', () => {
    const straight = buildPageRenderParams(buildInput()).geometry;
    const mirrored = buildPageRenderParams(buildInput({ isMirrored: true })).geometry;
    /**
     * После отражения линия поля стоит у правого края; блок обязан кончаться
     * на том же расстоянии от неё, на каком на нечётной странице начинался.
     */
    const mirroredMarginLineX = PAGE_WIDTH - MARGIN_LINE_X;

    expect(mirrored.blockWidth).toBeCloseTo(straight.blockWidth);
    expect(
      mirroredMarginLineX - (mirrored.leftPadding + mirrored.blockWidth)
    ).toBeCloseTo(straight.leftPadding - MARGIN_LINE_X);
  });

  it('переворачивает наклон блока вместе с фотографией', () => {
    const straight = buildPageRenderParams(buildInput()).geometry;
    const mirrored = buildPageRenderParams(buildInput({ isMirrored: true })).geometry;

    /**
     * Отражение переворачивает наклон разлиновки: линия, шедшая вниз слева
     * направо, идёт вниз справа налево. Блок обязан идти за ней, иначе текст
     * расходится с линиями веером.
     */
    expect(straight.blockRotate).toBe(SKEW_ANGLE);
    expect(mirrored.blockRotate).toBe(-SKEW_ANGLE);
  });

  it('не требует отдельной настройки отступа: смена семьи его пересчитывает', () => {
    const wider: PaperFamily = {
      ...FAMILY,
      width: PAGE_WIDTH * 2,
      ruling: {
        ...FAMILY.ruling,
        marginLineX: MARGIN_LINE_X * 2,
        margins: { ...FAMILY.ruling.margins, right: 60 },
      },
    };
    const first = buildPageRenderParams(buildInput({ isMirrored: true })).geometry;
    const second = buildPageRenderParams(
      buildInput({ isMirrored: true, family: wider })
    ).geometry;

    expect(second.leftPadding).not.toBeCloseTo(first.leftPadding);
  });
});

describe('предпросмотр и снимок', () => {
  it('отличаются только масштабом', () => {
    const preview = buildPageRenderParams(buildInput({ scale: 0.5 }));
    const full = buildPageRenderParams(buildInput({ scale: 3 }));

    expect(preview.scale).toBe(0.5);
    expect(full.scale).toBe(3);
    expect({ ...preview, scale: 0 }).toEqual({ ...full, scale: 0 });
  });

  it('рисуют одно и то же с точностью до масштаба', () => {
    const preview = createDrawRecorder();
    const full = createDrawRecorder();

    renderPageToCanvas(preview.context, buildPageRenderParams(buildInput({ scale: 1 })));
    renderPageToCanvas(full.context, buildPageRenderParams(buildInput({ scale: 4 })));

    const strip = (calls: typeof preview.calls) => {
      return calls.filter((call) => {
        return call.name !== 'scale';
      });
    };

    expect(strip(full.calls)).toEqual(strip(preview.calls));
    expect(findCalls(preview.calls, 'scale')).toEqual([[1, 1]]);
    expect(findCalls(full.calls, 'scale')).toEqual([[4, 4]]);
  });
});

describe('состав снимка', () => {
  it('содержит только лист и его текст', () => {
    const recorder = createDrawRecorder();

    renderPageToCanvas(recorder.context, buildPageRenderParams(buildInput()));

    const images = findCalls(recorder.calls, 'drawImage');
    const texts = findCalls(recorder.calls, 'fillText').map(([text]) => {
      return text;
    });

    expect(images).toHaveLength(1);
    expect(images[0]?.[0]).toBe(SHEET_IMAGE);
    expect(texts).toEqual(['раз', 'два', 'три']);
  });
});

describe('отражение фотографии', () => {
  it('переворачивает изображение по горизонтали', () => {
    const recorder = createDrawRecorder();
    const mirrored = { id: 'mirror' } as unknown as RenderImage;
    const result = mirrorRenderImage(SHEET_IMAGE, 400, 800, () => {
      return { context: recorder.context, image: mirrored };
    });

    expect(result).toBe(mirrored);
    expect(findCalls(recorder.calls, 'translate')).toEqual([[400, 0]]);
    expect(findCalls(recorder.calls, 'scale')).toEqual([[-1, 1]]);
    expect(findCalls(recorder.calls, 'drawImage')).toEqual([
      [SHEET_IMAGE, 0, 0, 400, 800],
    ]);
  });

  it('отдаёт исходную фотографию, когда контекста нет', () => {
    const result = mirrorRenderImage(SHEET_IMAGE, 400, 800, () => {
      return { context: null, image: SHEET_IMAGE };
    });

    expect(result).toBe(SHEET_IMAGE);
  });
});

describe('растеризация страницы', () => {
  it('кодирует снимок в формат фотографии с заданным качеством', () => {
    const surfaces = createSurfaceRecorder();
    const dataUrl = renderPageImage({
      params: buildPageRenderParams(buildInput({ scale: 3 })),
      pageWidth: PAGE_WIDTH,
      pageHeight: PAGE_HEIGHT,
      quality: 0.92,
      createSurface: surfaces.createSurface,
    });

    expect(surfaces.encodings).toEqual([{ type: PAGE_IMAGE_MIME, quality: 0.92 }]);
    expect(dataUrl.startsWith(`data:${PAGE_IMAGE_MIME}`)).toBe(true);
  });

  it('растеризует в разрешении, заданном масштабом', () => {
    const surfaces = createSurfaceRecorder();

    renderPageImage({
      params: buildPageRenderParams(buildInput({ scale: 3 })),
      pageWidth: PAGE_WIDTH,
      pageHeight: PAGE_HEIGHT,
      quality: 0.92,
      createSurface: surfaces.createSurface,
    });

    expect(surfaces.sizes).toEqual([{ width: PAGE_WIDTH * 3, height: PAGE_HEIGHT * 3 }]);
  });

  it('закрашивает лист под чернилами: прозрачности в формате с потерями нет', () => {
    const surfaces = createSurfaceRecorder();

    renderPageImage({
      params: buildPageRenderParams(buildInput({ scale: 1 })),
      pageWidth: PAGE_WIDTH,
      pageHeight: PAGE_HEIGHT,
      quality: 0.92,
      createSurface: surfaces.createSurface,
    });

    expect(findCalls(surfaces.calls, 'fillRect')).toEqual([
      [0, 0, PAGE_WIDTH, PAGE_HEIGHT],
    ]);
  });
});
