/**
 * @vitest-environment jsdom
 */
import { PAGE_WIDTH } from '@pages/Generator/config';
import type { Page } from '@pages/Generator/lib/paginate/paginate.types';
import { JPEG_QUALITY, RENDER_SCALE } from '@pages/Generator/lib/recipe';
import {
  DEFAULT_GENERATOR_STATE,
  useGeneratorStore,
} from '@pages/Generator/model/useGeneratorStore';
import { usePageRender } from '@pages/Generator/model/usePageRender';
import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildRenderFamily } from './helpers/paper-family';

const FAMILY = buildRenderFamily();

const PAGES: Page[] = [{ lines: [{ text: 'раз два', paragraphIndex: 0 }] }];

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
  it('отдаёт размер страницы в канонических пикселях семьи', () => {
    const { result } = renderHook(() => {
      return usePageRender(PAGES);
    });

    expect(result.current?.pageWidth).toBe(FAMILY.width);
    expect(result.current?.pageHeight).toBe(FAMILY.height);
  });

  it('вписывает предпросмотр в ширину листа на экране', () => {
    const { result } = renderHook(() => {
      return usePageRender(PAGES);
    });
    const source = result.current;

    expect(source && source.pageWidth * source.previewScale).toBeCloseTo(PAGE_WIDTH);
  });

  it('берёт разрешение снимка и качество кодирования из рецепта прогона', () => {
    const { result } = renderHook(() => {
      return usePageRender(PAGES);
    });
    const source = result.current;

    expect(source?.jpegQuality).toBe(JPEG_QUALITY);
    expect(source && source.exportScale / source.previewScale).toBeCloseTo(RENDER_SCALE);
  });

  it('снимает страницу шире предпросмотра не менее чем втрое', () => {
    const { result } = renderHook(() => {
      return usePageRender(PAGES);
    });
    const source = result.current;
    const previewWidth = Math.round(
      (source?.pageWidth || 0) * (source?.previewScale || 0)
    );
    const exportWidth = Math.round((source?.pageWidth || 0) * (source?.exportScale || 0));

    expect(exportWidth).toBeGreaterThanOrEqual(previewWidth * 3);
  });

  it('даёт предпросмотру и снимку одни параметры с точностью до масштаба', () => {
    const { result } = renderHook(() => {
      return usePageRender(PAGES);
    });
    const source = result.current;

    if (!source) {
      throw new Error('Источник отрисовки не собрался');
    }

    const preview = source.buildParams(source.previewScale);
    const full = source.buildParams(source.exportScale);

    expect(preview.scale).toBeCloseTo(source.previewScale);
    expect(full.scale).toBeCloseTo(source.exportScale);
    expect({ ...preview, scale: 0 }).toEqual({ ...full, scale: 0 });
  });
});
