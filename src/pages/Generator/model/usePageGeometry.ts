import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { deriveGeometry } from '../lib/calibrate/deriveGeometry';

import { buildBlockGeometry } from './buildPageRenderParams';
import { getPageCalibration } from './geometrySelectors';
import type { PageGeometryView } from './pageRender.types';
import { findFamily, findSheet, mergeFamilySheets } from './paperSelectors';
import { buildPageSheetSequence } from './recipeSelectors';
import { useFontMetrics } from './useFontMetrics';
import { useGeneratorStore } from './useGeneratorStore';

/**
 * Геометрия конкретной страницы: семья, лист, доставшийся странице, его
 * разлиновка, метрики шрифта и выведенное из них положение блока.
 *
 * Один хук на раскладку и на отрисовку: считай они геометрию порознь, переносы
 * посчитались бы по одной ширине блока, а отрисовались по другой.
 *
 * Лист страницы берётся из раздачи прогона (`buildPageSheetSequence`, та же,
 * что у `selectPageSheetId`), а не из выбора в панели: у каждой страницы своя
 * фотография со своим шагом, и геометрия идёт за ней.
 *
 * @param pageIndex — номер страницы, считая с нуля; не задан — текущая страница
 * @returns семья, лист, разлиновка, метрики и геометрия блока
 */
export const usePageGeometry = (pageIndex?: number): PageGeometryView => {
  const metrics = useFontMetrics();
  const {
    presetFamilies,
    userSheets,
    familyId,
    correction,
    activeFontFamily,
    resolvedPageIndex,
    runSeed,
    sheetId,
    isSheetPinned,
  } = useGeneratorStore(
    useShallow((state) => {
      return {
        presetFamilies: state.presetFamilies,
        userSheets: state.userSheets,
        familyId: state.familyId,
        correction: state.geometryCorrection,
        activeFontFamily: state.customFontFamily ?? state.fontFamily,
        resolvedPageIndex: pageIndex === undefined ? state.pageIndex : pageIndex,
        runSeed: state.runSeed,
        sheetId: state.sheetId,
        isSheetPinned: state.isSheetPinned,
      };
    })
  );
  const families = useMemo(() => {
    return mergeFamilySheets(presetFamilies, userSheets);
  }, [presetFamilies, userSheets]);
  const family = findFamily(families, familyId) || null;
  /**
   * Раздача листов живёт между отрисовками и собирается заново только со
   * сменой прогона, выбора листа или семьи: посчитанная в селекторе стора, она
   * пересобирала бы рецепт на каждое изменение стора.
   */
  const sheetIdAt = useMemo(() => {
    return buildPageSheetSequence({ runSeed, sheetId, isSheetPinned }, family);
  }, [runSeed, sheetId, isSheetPinned, family]);
  const sheet =
    family && family.sheets.length > 0
      ? findSheet(family, sheetIdAt(resolvedPageIndex)) || null
      : null;
  const calibration =
    family && sheet ? getPageCalibration(family, sheet, resolvedPageIndex) : null;

  return {
    family,
    sheet,
    ruling: calibration?.ruling || null,
    metrics,
    geometry: family ? buildBlockGeometry({ family, metrics, correction }) : null,
    sheetGeometry: calibration ? deriveGeometry(calibration, metrics, correction) : null,
    correction,
    fontFamily: activeFontFamily,
  };
};
