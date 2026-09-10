import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { PAGE_WIDTH } from '../config';
import type { Page } from '../lib/paginate/paginate.types';

import { buildPageRenderParams, isMirroredPage } from './buildPageRenderParams';
import { mirrorLightingField } from './mirrorLightingField';
import type { PageRenderSource } from './pageRender.types';
import { findSheet } from './paperSelectors';
import { selectPageSheetId, selectRunOptics } from './recipeSelectors';
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
 * Предпросмотр просит небольшое разрешение, сохранение — повышенное; всё
 * остальное у них общее, поэтому картинки расходиться не могут.
 *
 * Лист берётся тот, который выдал странице рецепт прогона, — тот же, что уйдёт
 * в пачку. Выбранный вручную экземпляр перебивает раздачу (см.
 * `selectPageSheetId`).
 *
 * @param pages — страницы прогона с посчитанной раскладкой
 * @returns источник отрисовки; `null` — семья листов не выбрана
 */
export const usePageRender = (pages: Page[]): PageRenderSource | null => {
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
      };
    })
  );
  const optics = useGeneratorStore(
    useShallow((state) => {
      return selectRunOptics(state, pages.length);
    })
  );
  /**
   * Лист страницы приходит идентификатором, а не объектом: селектор считает
   * рецепт, и строка сравнивается на равенство — иначе подписка гоняла бы
   * перерисовку на каждое изменение стора.
   */
  const sheetId = useGeneratorStore((state) => {
    return selectPageSheetId(state, state.pageIndex);
  });
  const sheet = (family && findSheet(family, sheetId)) || null;
  const isMirrored = isMirroredPage(pageIndex);
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

  if (!family) {
    return null;
  }

  const page = pages[pageIndex] || pages[0] || EMPTY_PAGE;
  const previewScale = PAGE_WIDTH / family.width;

  return {
    buildParams: (scale) => {
      return buildPageRenderParams({
        page,
        family,
        sheet,
        sheetImage,
        metrics,
        correction,
        isMirrored,
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
    pageWidth: family.width,
    pageHeight: family.height,
    previewScale,
    exportScale: previewScale * optics.renderScale,
    jpegQuality: optics.jpegQuality,
  };
};
