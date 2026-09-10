import { buildRunRecipe, JPEG_QUALITY, RENDER_SCALE } from '../lib/recipe/buildRunRecipe';
import type { PageOpticsRecipe, RunRecipe } from '../lib/recipe/recipe.types';

/**
 * Оптика по умолчанию: те же значения, что выводит рецепт. Идёт в дело, когда
 * семья листов не выбрана и рецепта нет, — растеризовать страницу всё равно
 * нужно чем-то.
 */
const DEFAULT_OPTICS: PageOpticsRecipe = {
  jpegQuality: JPEG_QUALITY,
  renderScale: RENDER_SCALE,
};

import type { GeneratorState } from './generator.types';
import { selectActiveFamily } from './paperSelectors';

/**
 * Рецепт прогона по текущему состоянию. Выведен из `runSeed`, поэтому правка
 * текста его не меняет: чтобы рецепт стал другим, нужен новый прогон.
 *
 * Частоты побуквенной обработки рецепт умеет выводить из seed, но в
 * генераторе это слайдеры, и пользовательский ввод главнее: значения стора
 * передаются в сборку и заменяют выведенные.
 *
 * @param state — состояние генератора
 * @param pageCount — число страниц прогона
 * @returns рецепт; `null` — семья листов не выбрана
 */
export const selectRunRecipe = (
  state: GeneratorState,
  pageCount: number
): RunRecipe | null => {
  const family = selectActiveFamily(state);

  if (!family) {
    return null;
  }

  return buildRunRecipe({
    seed: state.runSeed,
    family,
    pageCount: Math.max(1, pageCount),
    flags: state.flags,
    inkColor: state.isInkColorAuto ? null : state.inkColor,
    wordFrequency: state.wordFrequency,
    letterFrequency: state.letterFrequency,
  });
};

/**
 * Экземпляр листа страницы. Раздачу делает рецепт прогона: соседние страницы
 * получают разные листы, и на одном seed раздача повторяется. Ручной выбор
 * перебивает раздачу целиком — выбранный лист встаёт на все страницы.
 *
 * Одно правило на предпросмотр и на пачку: разойдись они — на экране был бы
 * один лист, а в архиве другой.
 *
 * @param selection — выбор экземпляра листа из состояния генератора
 * @param recipe — рецепт прогона; `null` — рецепта нет, остаётся выбранный лист
 * @param pageIndex — номер страницы, считая с нуля
 * @returns идентификатор экземпляра листа
 */
export const pickPageSheetId = (
  selection: Pick<GeneratorState, 'sheetId' | 'isSheetPinned'>,
  recipe: RunRecipe | null,
  pageIndex: number
): string => {
  const { sheetId, isSheetPinned } = selection;

  if (isSheetPinned) {
    return sheetId;
  }

  return recipe?.pages[pageIndex]?.sheetId || sheetId;
};

/**
 * Экземпляр листа страницы по одному состоянию генератора.
 *
 * Число страниц прогона знать не нужно: рецепт раздаёт листы хвостом — выбор
 * страницы определяется её собственным подпотоком и листом предыдущей
 * страницы, — поэтому рецепта до этой страницы включительно достаточно.
 *
 * @param state — состояние генератора
 * @param pageIndex — номер страницы, считая с нуля
 * @returns идентификатор экземпляра листа
 */
export const selectPageSheetId = (state: GeneratorState, pageIndex: number): string => {
  return pickPageSheetId(state, selectRunRecipe(state, pageIndex + 1), pageIndex);
};

/**
 * Оптика прогона: чем растеризуется страница. Отдельным селектором, потому что
 * сборка рецепта проходит по всем страницам, а вызывающей стороне нужны две
 * величины.
 *
 * @param state — состояние генератора
 * @param pageCount — число страниц прогона
 * @returns качество кодирования и множитель разрешения снимка
 */
export const selectRunOptics = (
  state: GeneratorState,
  pageCount: number
): PageOpticsRecipe => {
  return selectRunRecipe(state, pageCount)?.optics || DEFAULT_OPTICS;
};
