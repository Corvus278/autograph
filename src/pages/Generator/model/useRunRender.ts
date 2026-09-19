import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';

import type { LayoutPage, Page } from '../lib/paginate/paginate.types';

import { resolveShownPageIndex } from './buildPageRenderParams';
import { buildPageTask } from './buildPageTask';
import type { PageFontSource, RunRenderPlan } from './pageTask.types';
import { findSheet } from './paperSelectors';
import { buildPageSheetSequence, selectPageRecipe } from './recipeSelectors';
import { findFontUrl } from './useFontGlyphs';
import { useGeneratorStore } from './useGeneratorStore';
import { usePageGeometry } from './usePageGeometry';

/**
 * Пустая страница: за номером, которого в прогоне нет, всё равно рисуется
 * лист, а не выбрасывается исключение.
 */
const EMPTY_PAGE: Page = { lines: [] };

/**
 * План отрисовки всего прогона: задание на любую его страницу.
 *
 * Что берётся из рецепта, а что из настроек, решается одним правилом: снимок
 * обязан совпадать с тем, что пользователь видит в предпросмотре. Цвет чернил,
 * почерк и геометрия приходят оттуда же, откуда их берёт предпросмотр; лист
 * страницы — тот, на котором она разложена, а без него — из раздачи прогона,
 * ровно как в `usePageRender`, поэтому страница в архиве повторяет показанную.
 *
 * Снимок каждой страницы равен кадру её листа, поэтому страницы одной пачки
 * бывают разного размера.
 *
 * @param pages — страницы прогона с посчитанной раскладкой и листом каждой
 * @returns план отрисовки; `null` — семья листов не выбрана или листов в ней
 *   нет
 */
export const useRunRender = (pages: LayoutPage[]): RunRenderPlan | null => {
  const { family, metrics, correction, fontFamily } = usePageGeometry();
  const {
    pageIndex,
    isBackgroundHidden,
    hasContourVariance,
    runSeed,
    sheetId,
    isSheetPinned,
  } = useGeneratorStore(
    useShallow((state) => {
      return {
        pageIndex: state.pageIndex,
        isBackgroundHidden: state.isBackgroundHidden,
        hasContourVariance: state.realism.hasContourVariance,
        runSeed: state.runSeed,
        sheetId: state.sheetId,
        isSheetPinned: state.isSheetPinned,
      };
    })
  );
  /**
   * Цвет чернил и почерк — только из рецепта прогона: так цвет у предпросмотра
   * и снимка один, а правка текста рисунок почерка не трогает.
   */
  const recipe = useGeneratorStore(
    useShallow((state) => {
      return selectPageRecipe(state, pages.length);
    })
  );
  /**
   * Раздача листов живёт между отрисовками: пачка просит страницы по порядку,
   * и наращиваемая раздача проходит их за один проход.
   */
  const sheetIdAt = useMemo(() => {
    return buildPageSheetSequence({ runSeed, sheetId, isSheetPinned }, family);
  }, [runSeed, sheetId, isSheetPinned, family]);

  if (!family || family.sheets.length === 0) {
    return null;
  }

  const pageCount = Math.max(1, pages.length);
  const fontUrl = findFontUrl(fontFamily);
  const font: PageFontSource | null = fontUrl
    ? { family: fontFamily, url: fontUrl, hasVariance: hasContourVariance }
    : null;

  return {
    pageCount,
    pageIndex: resolveShownPageIndex(pageIndex, pages.length),
    buildTask: (index) => {
      const page = pages[index];
      const sheet = findSheet(family, page?.sheetId || sheetIdAt(index));

      if (!sheet) {
        throw new Error('Семья листов пуста: страницу не на чем отрисовать');
      }

      return buildPageTask({
        page: page || EMPTY_PAGE,
        family,
        sheet,
        pageIndex: index,
        isBackgroundHidden,
        metrics,
        correction,
        inkColor: recipe.inkColor,
        fontFamily,
        flags: recipe.flags,
        wordFrequency: recipe.wordFrequency,
        letterFrequency: recipe.letterFrequency,
        seed: recipe.handwritingSeed,
        runSeed,
        font,
        quality: recipe.jpegQuality,
      });
    },
  };
};
