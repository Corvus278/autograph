// @vitest-environment jsdom

import { CUSTOM_FONT_FAMILY } from '@pages/Generator/config';
import type { FontMetricsProbeFactory } from '@pages/Generator/lib/measure/measure.types';
import {
  clearFontMetricsCache,
  measureFontMetrics,
} from '@pages/Generator/lib/measure/measureFontMetrics';
import { useCustomFont } from '@pages/Generator/model/useCustomFont';
import {
  DEFAULT_GENERATOR_STATE,
  useGeneratorStore,
} from '@pages/Generator/model/useGeneratorStore';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

/**
 * Кегль щупа: доли метрик считаются делением на него, поэтому замеры ниже
 * читаются как проценты.
 */
const PROBE_FONT_SIZE_PX = 100;

/**
 * Щуп с заданной высотой строчных: два файла под одним именем семейства
 * отличаются именно ей.
 */
const buildProbe = (xHeightPx: number): FontMetricsProbeFactory => {
  return () => {
    return {
      measureInkAscent: () => {
        return xHeightPx;
      },
      measureFontAscent: () => {
        return 95;
      },
      measureLineHeight: () => {
        return 125;
      },
      fontSizePx: PROBE_FONT_SIZE_PX,
    };
  };
};

/**
 * Файл, который заглушка `FontFace` в jsdom принимает за шрифт: настоящий
 * `.ttf` начинается с нулевого байта версии sfnt.
 */
const buildFontFile = (): File => {
  return new File([new Uint8Array([0, 1, 0, 0])], 'font.ttf');
};

beforeEach(() => {
  useGeneratorStore.setState(DEFAULT_GENERATOR_STATE);
  clearFontMetricsCache();
});

afterEach(() => {
  cleanup();
});

describe('метрики своего шрифта', () => {
  it('пересчитываются после повторной загрузки под тем же именем', async () => {
    const { result } = renderHook(() => {
      return useCustomFont();
    });

    await act(async () => {
      await result.current.load(buildFontFile());
    });

    const first = measureFontMetrics(CUSTOM_FONT_FAMILY, buildProbe(48));

    await act(async () => {
      await result.current.load(buildFontFile());
    });

    const second = measureFontMetrics(CUSTOM_FONT_FAMILY, buildProbe(70));

    expect(first.xHeight).toBeCloseTo(0.48);
    expect(second.xHeight).toBeCloseTo(0.7);
  });

  it('не сбрасываются на нечитаемом файле: шрифт остался прежним', async () => {
    const { result } = renderHook(() => {
      return useCustomFont();
    });

    await act(async () => {
      await result.current.load(buildFontFile());
    });

    const first = measureFontMetrics(CUSTOM_FONT_FAMILY, buildProbe(48));

    await act(async () => {
      await result.current.load(new File(['совсем не шрифт'], 'font.ttf'));
    });

    const second = measureFontMetrics(CUSTOM_FONT_FAMILY, buildProbe(70));

    expect(second.xHeight).toBe(first.xHeight);
  });
});
