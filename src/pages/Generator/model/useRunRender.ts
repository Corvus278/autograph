import { useShallow } from 'zustand/react/shallow';

import { PAGE_WIDTH } from '../config';
import type { Page } from '../lib/paginate/paginate.types';
import { buildRunRecipe } from '../lib/recipe';

import { isMirroredPage } from './buildPageRenderParams';
import { buildPageTask } from './buildPageTask';
import type { PageFontSource, RunRenderPlan } from './pageTask.types';
import { findSheet } from './paperSelectors';
import { pickPageSheetId, selectRunOptics } from './recipeSelectors';
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
 * страницы — из рецепта, тем же `pickPageSheetId`, которым его берёт
 * предпросмотр, поэтому страница в архиве повторяет показанную.
 *
 * @param pages — страницы прогона с посчитанной раскладкой
 * @returns план отрисовки; `null` — семья листов не выбрана
 */
export const useRunRender = (pages: Page[]): RunRenderPlan | null => {
  const { family, metrics, correction, fontFamily } = usePageGeometry();
  const {
    pageIndex,
    isBackgroundHidden,
    inkColor,
    isInkColorAuto,
    flags,
    wordFrequency,
    letterFrequency,
    seed,
    runSeed,
    hasContourVariance,
    sheetId,
    isSheetPinned,
  } = useGeneratorStore(
    useShallow((state) => {
      return {
        pageIndex: state.pageIndex,
        isBackgroundHidden: state.isBackgroundHidden,
        inkColor: state.inkColor,
        isInkColorAuto: state.isInkColorAuto,
        flags: state.flags,
        wordFrequency: state.wordFrequency,
        letterFrequency: state.letterFrequency,
        seed: state.seed,
        runSeed: state.runSeed,
        hasContourVariance: state.hasContourVariance,
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

  if (!family) {
    return null;
  }

  const pageCount = Math.max(1, pages.length);
  const recipe = buildRunRecipe({
    seed: runSeed,
    family,
    pageCount,
    flags,
    inkColor: isInkColorAuto ? null : inkColor,
    wordFrequency,
    letterFrequency,
  });
  const fontUrl = findFontUrl(fontFamily);
  const font: PageFontSource | null = fontUrl
    ? { family: fontFamily, url: fontUrl, hasVariance: hasContourVariance }
    : null;
  const scale = (PAGE_WIDTH / family.width) * optics.renderScale;

  return {
    pageCount,
    pageIndex,
    buildTask: (index) => {
      const pageSheetId = pickPageSheetId({ sheetId, isSheetPinned }, recipe, index);

      return buildPageTask({
        page: pages[index] || EMPTY_PAGE,
        family,
        sheet: findSheet(family, pageSheetId) || null,
        isBackgroundHidden,
        isMirrored: isMirroredPage(index),
        metrics,
        correction,
        inkColor,
        fontFamily,
        flags,
        wordFrequency,
        letterFrequency,
        seed,
        runSeed,
        font,
        scale,
        quality: optics.jpegQuality,
      });
    },
  };
};
