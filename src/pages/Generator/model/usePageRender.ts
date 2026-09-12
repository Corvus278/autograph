import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { PAGE_WIDTH } from '../config';
import type { LayoutPage, Page } from '../lib/paginate/paginate.types';

import {
  buildPageRenderParams,
  isMirroredPage,
  resolveShownPageIndex,
} from './buildPageRenderParams';
import { getPageCalibration } from './geometrySelectors';
import { mirrorLightingField } from './mirrorLightingField';
import type { PageRenderSource } from './pageRender.types';
import { findSheet } from './paperSelectors';
import { buildPageSheetSequence, selectRunOptics } from './recipeSelectors';
import { useFontGlyphs } from './useFontGlyphs';
import { useGeneratorStore } from './useGeneratorStore';
import { usePageGeometry } from './usePageGeometry';
import { useSheetImage } from './useSheetImage';
import { useSheetTexture } from './useSheetTexture';

/**
 * Пустая страница: генератор всегда показывает лист, даже пока не досчиталась
 * разбивка.
 */
const EMPTY_PAGE: Page = { lines: [] };

/**
 * Источник отрисовки текущей страницы: один на предпросмотр и на сохранение.
 *
 * Страница равна кадру своего листа. Предпросмотр вписывает кадр в ширину листа
 * на экране, поэтому его высота идёт за пропорциями фотографии и меняется при
 * листании страниц, которым достались разные листы.
 *
 * Лист берётся тот, на котором страница разложена (`LayoutPage.sheetId`): по
 * нему посчитаны перенос и вместимость, и на другом листе строки разошлись бы с
 * разлиновкой. Пока раскладка листа странице не дала, лист берётся из раздачи
 * прогона — той же, по которой раскладывает `usePageLayout`.
 *
 * @param pages — страницы прогона с посчитанной раскладкой и листом каждой
 * @returns источник отрисовки; `null` — семья листов не выбрана или листов в
 *   ней нет
 */
export const usePageRender = (pages: LayoutPage[]): PageRenderSource | null => {
  const { family, metrics, correction, fontFamily } = usePageGeometry();
  const {
    pageIndex,
    isBackgroundHidden,
    inkColor,
    flags,
    hasContourVariance,
    wordFrequency,
    letterFrequency,
    seed,
    runSeed,
    sheetId,
    isSheetPinned,
  } = useGeneratorStore(
    useShallow((state) => {
      return {
        pageIndex: state.pageIndex,
        isBackgroundHidden: state.isBackgroundHidden,
        inkColor: state.inkColor,
        flags: state.flags,
        hasContourVariance: state.hasContourVariance,
        wordFrequency: state.wordFrequency,
        letterFrequency: state.letterFrequency,
        seed: state.seed,
        runSeed: state.runSeed,
        sheetId: state.sheetId,
        isSheetPinned: state.isSheetPinned,
      };
    })
  );
  const optics = useGeneratorStore(
    useShallow((state) => {
      return selectRunOptics(state, pages.length);
    })
  );
  /**
   * Раздача листов живёт между отрисовками и собирается заново только со
   * сменой прогона, выбора листа или семьи: пересобранная на каждый рендер, она
   * заново проходила бы все страницы до текущей.
   */
  const sheetIdAt = useMemo(() => {
    return buildPageSheetSequence({ runSeed, sheetId, isSheetPinned }, family);
  }, [runSeed, sheetId, isSheetPinned, family]);
  /**
   * Лист и сторона разворота берутся по показанной странице, а не по номеру,
   * которого в раскладке ещё нет.
   */
  const drawnIndex = resolveShownPageIndex(pageIndex, pages.length);
  const layoutPage = pages[drawnIndex];
  const sheet =
    (family && findSheet(family, layoutPage?.sheetId || sheetIdAt(drawnIndex))) || null;
  const isMirrored = isMirroredPage(drawnIndex);
  const sheetImage = useSheetImage(isBackgroundHidden ? null : sheet, isMirrored);
  const texture = useSheetTexture(sheet);
  const glyphSource = useFontGlyphs(fontFamily);
  const sheetLighting = sheet?.lighting || null;
  /**
   * Поле освещения отражается вместе с листом, поэтому пересчитывается только
   * при смене экземпляра или стороны разворота: массив узлов живёт до
   * следующей отрисовки, и собирать его на каждый кадр незачем.
   */
  const lighting = useMemo(() => {
    return isMirrored ? mirrorLightingField(sheetLighting) : sheetLighting;
  }, [sheetLighting, isMirrored]);

  if (!family || !sheet) {
    return null;
  }

  const page = layoutPage || EMPTY_PAGE;
  const calibration = getPageCalibration(family, sheet, drawnIndex);

  return {
    buildParams: (scale) => {
      return buildPageRenderParams({
        page,
        calibration,
        sheetImage,
        metrics,
        correction,
        inkColor,
        ink: { lighting, texture, seed: runSeed },
        glyphs: glyphSource
          ? { source: glyphSource, hasVariance: hasContourVariance }
          : null,
        fontFamily,
        flags,
        wordFrequency,
        letterFrequency,
        seed,
        scale,
      });
    },
    pageWidth: sheet.width,
    pageHeight: sheet.height,
    previewScale: PAGE_WIDTH / sheet.width,
    jpegQuality: optics.jpegQuality,
  };
};
