import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { buildBlockGeometry } from './buildPageRenderParams';
import type { PageGeometryView } from './pageRender.types';
import { findFamily, mergeFamilySheets } from './paperSelectors';
import { useFontMetrics } from './useFontMetrics';
import { useGeneratorStore } from './useGeneratorStore';

/**
 * Геометрия текущей страницы: семья, метрики шрифта и выведенное из них
 * положение блока.
 *
 * Один хук на раскладку и на отрисовку: считай они геометрию порознь, переносы
 * посчитались бы по одной ширине блока, а отрисовались по другой.
 *
 * Экземпляра листа здесь нет: разлиновка принадлежит семье, а какой лист
 * достался странице — дело рецепта прогона (`selectPageSheetId`), и от него
 * геометрия не зависит.
 *
 * @returns семья, метрики и геометрия блока
 */
export const usePageGeometry = (): PageGeometryView => {
  const metrics = useFontMetrics();
  const { presetFamilies, userSheets, familyId, correction, activeFontFamily } =
    useGeneratorStore(
      useShallow((state) => {
        return {
          presetFamilies: state.presetFamilies,
          userSheets: state.userSheets,
          familyId: state.familyId,
          correction: state.geometryCorrection,
          activeFontFamily: state.customFontFamily ?? state.fontFamily,
        };
      })
    );
  const families = useMemo(() => {
    return mergeFamilySheets(presetFamilies, userSheets);
  }, [presetFamilies, userSheets]);
  const family = findFamily(families, familyId) || null;
  const geometry = family ? buildBlockGeometry({ family, metrics, correction }) : null;

  return { family, metrics, geometry, correction, fontFamily: activeFontFamily };
};
