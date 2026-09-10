import { useEffect, useState } from 'react';

import type { PaperSheet } from '../lib/paper/paper.types';
import type { InkTextureImage } from '../lib/render';
import { loadRenderImage } from '../lib/render';

/**
 * Карта текстуры выбранного экземпляра листа, готовая к загрузке в шейдер.
 *
 * Отражения здесь нет намеренно: в карте зерно бумаги, а не форма листа, и с
 * какой стороны его ни поверни — оно одинаково.
 *
 * @param sheet — выбранный экземпляр листа; `null` — экземпляра нет
 * @returns изображение карты; `null` — карты нет или она не загрузилась
 */
export const useSheetTexture = (sheet: PaperSheet | null): InkTextureImage | null => {
  const [texture, setTexture] = useState<InkTextureImage | null>(null);
  const src = sheet?.texture?.src || '';

  useEffect(() => {
    if (!src) {
      setTexture(null);

      return;
    }

    let isCancelled = false;

    const applyTexture = async () => {
      try {
        const loaded = await loadRenderImage(src);

        if (!isCancelled) {
          setTexture(loaded);
        }
      } catch {
        if (!isCancelled) {
          setTexture(null);
        }
      }
    };

    void applyTexture();

    return () => {
      isCancelled = true;
    };
  }, [src]);

  return texture;
};
