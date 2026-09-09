import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { PAGE_BACKGROUNDS, PAGE_WIDTH } from '../config';

import { useGeneratorStore } from './useGeneratorStore';
import type { PageBackgroundView } from './usePageBackground.types';

/**
 * Отдаёт фон текущей страницы и её размеры. Высота считается по пропорциям
 * картинки: от неё зависит, сколько строк помещается на страницу.
 *
 * Размеры встроенных фонов известны заранее, у загруженного их приходится
 * узнавать у самой картинки — до её загрузки лист рисовать не по чему.
 */
export const usePageBackground = (): PageBackgroundView => {
  const { backgroundId, customBackgroundSrc, isBackgroundHidden } = useGeneratorStore(
    useShallow((state) => {
      return {
        backgroundId: state.backgroundId,
        customBackgroundSrc: state.customBackgroundSrc,
        isBackgroundHidden: state.isBackgroundHidden,
      };
    })
  );
  const [customRatio, setCustomRatio] = useState<number | null>(null);

  useEffect(() => {
    if (!customBackgroundSrc) {
      setCustomRatio(null);

      return;
    }

    let isCancelled = false;
    const image = new Image();

    image.addEventListener('load', () => {
      if (!isCancelled && image.naturalWidth > 0) {
        setCustomRatio(image.naturalHeight / image.naturalWidth);
      }
    });
    image.src = customBackgroundSrc;

    return () => {
      isCancelled = true;
    };
  }, [customBackgroundSrc]);

  if (isBackgroundHidden) {
    return { src: null, width: PAGE_WIDTH, height: null };
  }

  if (customBackgroundSrc) {
    return {
      src: customBackgroundSrc,
      width: PAGE_WIDTH,
      height: customRatio === null ? null : Math.round(PAGE_WIDTH * customRatio),
    };
  }

  const background =
    PAGE_BACKGROUNDS.find(({ id }) => {
      return id === backgroundId;
    }) ?? PAGE_BACKGROUNDS[0];

  if (!background) {
    return { src: null, width: PAGE_WIDTH, height: null };
  }

  return {
    src: background.src,
    width: PAGE_WIDTH,
    height: Math.round((PAGE_WIDTH * background.height) / background.width),
  };
};
