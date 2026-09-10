import { useEffect, useState } from 'react';

import type { FontMetrics } from '../lib/measure/measure.types';
import {
  FALLBACK_FONT_METRICS,
  loadFontMetrics,
} from '../lib/measure/measureFontMetrics';

import { useGeneratorStore } from './useGeneratorStore';

/**
 * Метрики выбранного шрифта. До загрузки начертания отдаются запасные:
 * геометрию всё равно нужно из чего-то вывести, а замер по подстановочному
 * шрифту посадил бы текст мимо разлиновки.
 *
 * @returns доли кегля выбранного шрифта
 */
export const useFontMetrics = (): FontMetrics => {
  const fontFamily = useGeneratorStore((state) => {
    return state.customFontFamily ?? state.fontFamily;
  });
  const [metrics, setMetrics] = useState<FontMetrics>(FALLBACK_FONT_METRICS);

  useEffect(() => {
    let isCancelled = false;

    const applyMetrics = async () => {
      const measured = await loadFontMetrics(fontFamily);

      if (!isCancelled) {
        setMetrics(measured);
      }
    };

    void applyMetrics();

    return () => {
      isCancelled = true;
    };
  }, [fontFamily]);

  return metrics;
};
