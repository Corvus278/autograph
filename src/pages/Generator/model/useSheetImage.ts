import { useEffect, useState } from 'react';

import type { PaperSheet } from '../lib/paper/paper.types';
import type { RenderImage } from '../lib/render';
import { loadRenderImage } from '../lib/render';

import { mirrorRenderImage } from './mirrorRenderImage';

/**
 * Фотография выбранного экземпляра листа, готовая к отрисовке.
 *
 * Отражение живёт здесь, а не в рендерере: рендерер рисует фон как есть, а
 * правая половина разворота отличается от левой именно отражённой фотографией.
 * Отражается один раз на смену листа или страницы, а не на каждый кадр.
 *
 * @param sheet — выбранный экземпляр листа; `null` — фон не рисуется
 * @param isMirrored — страница отражается по горизонтали
 * @returns изображение листа; `null` — пока не загрузилось или не загрузилось
 *   вовсе
 */
export const useSheetImage = (
  sheet: PaperSheet | null,
  isMirrored: boolean
): RenderImage | null => {
  const [image, setImage] = useState<RenderImage | null>(null);
  const src = sheet?.src || '';
  const width = sheet?.width || 0;
  const height = sheet?.height || 0;

  useEffect(() => {
    if (!src) {
      setImage(null);

      return;
    }

    let isCancelled = false;

    const applyImage = async () => {
      try {
        const loaded = await loadRenderImage(src);

        if (!isCancelled) {
          setImage(isMirrored ? mirrorRenderImage(loaded, width, height) : loaded);
        }
      } catch {
        if (!isCancelled) {
          setImage(null);
        }
      }
    };

    void applyImage();

    return () => {
      isCancelled = true;
    };
  }, [src, isMirrored, width, height]);

  return image;
};
