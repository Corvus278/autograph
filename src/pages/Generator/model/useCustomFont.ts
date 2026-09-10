import { useState } from 'react';

import { CUSTOM_FONT_FAMILY } from '../config';
import { clearFontMetricsCache } from '../lib/measure/measureFontMetrics';

import { clearLayoutCache } from './measureLayout';
import type { CustomFontControl } from './useCustomFont.types';
import { useGeneratorStore } from './useGeneratorStore';

/**
 * Подключает пользовательский шрифт через FontFace API. В отличие от инъекции
 * `@font-face` с data URL, здесь видно, что файл не разобрался: браузер
 * отклоняет `load()`, а не молча подставляет другое начертание.
 */
export const useCustomFont = (): CustomFontControl => {
  const [error, setError] = useState<string | null>(null);
  const setCustomFontFamily = useGeneratorStore((state) => {
    return state.setCustomFontFamily;
  });

  const load = async (file: File): Promise<void> => {
    try {
      const source = await file.arrayBuffer();
      const face = new FontFace(CUSTOM_FONT_FAMILY, source);

      await face.load();
      document.fonts.add(face);
      /**
       * Имя семейства у своего шрифта всегда одно, поэтому ключ кэша от смены
       * файла не меняется — сбрасываем кэши руками. Метрики наравне с
       * раскладкой: по ним считается кегль, и метрики прошлого файла посадили
       * бы новый шрифт мимо разлиновки.
       */
      clearLayoutCache();
      clearFontMetricsCache();
      setCustomFontFamily(CUSTOM_FONT_FAMILY);
      setError(null);
    } catch {
      setError('Не удалось прочитать шрифт. Нужен файл .ttf');
    }
  };

  const reset = (): void => {
    setCustomFontFamily(null);
    setError(null);
  };

  return { error, load, reset };
};
