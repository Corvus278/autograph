/**
 * @vitest-environment jsdom
 */
import { PAGE_WIDTH } from '@pages/Generator/config';
import { deriveGeometry } from '@pages/Generator/lib/calibrate/deriveGeometry';
import type { LayoutPage } from '@pages/Generator/lib/paginate/paginate.types';
import type { PaperFamily } from '@pages/Generator/lib/paper';
import { JPEG_QUALITY } from '@pages/Generator/lib/recipe';
import { getPageCalibration } from '@pages/Generator/model/geometrySelectors';
import { findSheet } from '@pages/Generator/model/paperSelectors';
import { buildPageSheetSequence } from '@pages/Generator/model/recipeSelectors';
import {
  DEFAULT_GENERATOR_STATE,
  useGeneratorStore,
} from '@pages/Generator/model/useGeneratorStore';
import { usePageGeometry } from '@pages/Generator/model/usePageGeometry';
import { usePageRender } from '@pages/Generator/model/usePageRender';
import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildRenderFamily, buildSheet } from './helpers/paper-family';

/**
 * Кадр второго листа: и ширина, и пропорции отличаются от первого, поэтому
 * размер страницы, взятый не с того листа, виден сразу.
 */
const OTHER_FRAME = { width: 300, height: 360 };

/**
 * Семья-модель, у листов которой разные кадры при одной разлиновке.
 *
 * @returns семья из двух листов с разными кадрами
 */
const buildFramedFamily = (): PaperFamily => {
  const family = buildRenderFamily();

  return {
    ...family,
    sheets: family.sheets.map((sheet, index) => {
      return index === 0 ? sheet : buildSheet(sheet.id, sheet.ruling, OTHER_FRAME);
    }),
  };
};

const FAMILY = buildFramedFamily();

/**
 * Лист, который раздача прогона на странице не выбрала бы: по нему видно, что
 * отрисовка берёт лист раскладки, а не пересчитывает раздачу.
 *
 * @param pageIndex — номер страницы, считая с нуля
 * @returns идентификатор листа, отличный от листа раздачи
 */
const pickLayoutSheetId = (pageIndex: number): string => {
  const sheetIdAt = buildPageSheetSequence(useGeneratorStore.getState(), FAMILY);
  const other = FAMILY.sheets.find(({ id }) => {
    return id !== sheetIdAt(pageIndex);
  });

  return other?.id || '';
};

/**
 * Страницы раскладки на листах, отличных от раздачи.
 *
 * @returns две страницы со своими листами
 */
const buildLayoutPages = (): LayoutPage[] => {
  return [0, 1].map((pageIndex) => {
    return {
      sheetId: pickLayoutSheetId(pageIndex),
      lines: [{ text: `раз два ${pageIndex}`, paragraphIndex: 0 }],
    };
  });
};

/**
 * Кадр листа страницы раскладки.
 *
 * @param page — страница раскладки
 * @returns ширина и высота кадра
 */
const frameOf = (page: LayoutPage | undefined) => {
  const sheet = findSheet(FAMILY, page?.sheetId || '');

  return { width: sheet?.width, height: sheet?.height };
};

/**
 * Источник отрисовки текущей страницы вместе с геометрией, по которой
 * генератор считает раскладку.
 *
 * @param pages — страницы раскладки
 * @returns источник отрисовки и вид геометрии
 */
const renderSource = (pages: LayoutPage[]) => {
  const { result } = renderHook(() => {
    return { source: usePageRender(pages), view: usePageGeometry() };
  });

  return result.current;
};

beforeEach(() => {
  useGeneratorStore.setState({
    ...DEFAULT_GENERATOR_STATE,
    presetFamilies: [FAMILY],
    familyId: FAMILY.id,
    sheetId: FAMILY.sheets[0]?.id || '',
  });
});

afterEach(() => {
  cleanup();
});

describe('источник отрисовки страницы', () => {
  it('отдаёт размер страницы кадром листа, на котором она разложена', () => {
    const pages = buildLayoutPages();

    [0, 1].forEach((pageIndex) => {
      useGeneratorStore.setState({ pageIndex });

      const { source } = renderSource(pages);

      expect({ width: source?.pageWidth, height: source?.pageHeight }).toEqual(
        frameOf(pages[pageIndex])
      );
    });

    expect(frameOf(pages[0])).not.toEqual(frameOf(pages[1]));
  });

  it('не меняет размер страницы, когда фон скрыт', () => {
    const pages = buildLayoutPages();
    const shown = renderSource(pages).source;

    useGeneratorStore.getState().setBackgroundHidden(true);

    const hidden = renderSource(pages).source;

    expect(hidden?.pageWidth).toBe(shown?.pageWidth);
    expect(hidden?.pageHeight).toBe(shown?.pageHeight);
    expect({ width: hidden?.pageWidth, height: hidden?.pageHeight }).toEqual(
      frameOf(pages[0])
    );
  });

  it('берёт лист раздачи, пока у страницы раскладки листа нет', () => {
    const sheetIdAt = buildPageSheetSequence(useGeneratorStore.getState(), FAMILY);
    const { source } = renderSource([{ sheetId: '', lines: [] }]);

    expect({ width: source?.pageWidth, height: source?.pageHeight }).toEqual(
      frameOf({ sheetId: sheetIdAt(0), lines: [] })
    );
  });

  it('вписывает предпросмотр в ширину листа на экране на любом кадре', () => {
    const pages = buildLayoutPages();

    [0, 1].forEach((pageIndex) => {
      useGeneratorStore.setState({ pageIndex });

      const { source } = renderSource(pages);

      expect(source && source.pageWidth * source.previewScale).toBeCloseTo(PAGE_WIDTH);
    });
  });

  it('считает геометрию зеркальной страницы по разлиновке её листа, как раскладка', () => {
    const pages = buildLayoutPages();
    const sheet = findSheet(FAMILY, pages[1]?.sheetId || '');

    if (!sheet) {
      throw new Error('Семья-модель без листов');
    }

    useGeneratorStore.setState({
      pageIndex: 1,
      geometryCorrection: {
        ...DEFAULT_GENERATOR_STATE.geometryCorrection,
        topOffset: 0.5,
        leftPadding: 0.25,
      },
    });

    const { source, view } = renderSource(pages);
    const calibration = getPageCalibration(FAMILY, sheet, 1);
    const geometry = source?.buildParams(1).geometry;

    expect(geometry).toEqual({
      ...deriveGeometry(calibration, view.metrics, view.correction),
      blockRotate: calibration.ruling.skewAngle,
      fontMetrics: view.metrics,
    });
  });

  it('берёт качество кодирования из рецепта прогона', () => {
    const { source } = renderSource(buildLayoutPages());

    expect(source?.jpegQuality).toBe(JPEG_QUALITY);
  });

  it('даёт предпросмотру и снимку одни параметры с точностью до масштаба', () => {
    const { source } = renderSource(buildLayoutPages());

    if (!source) {
      throw new Error('Источник отрисовки не собрался');
    }

    const preview = source.buildParams(source.previewScale);
    const full = source.buildParams(1);

    expect(preview.scale).toBeCloseTo(source.previewScale);
    expect(full.scale).toBe(1);
    expect({ ...preview, scale: 0 }).toEqual({ ...full, scale: 0 });
  });
});
