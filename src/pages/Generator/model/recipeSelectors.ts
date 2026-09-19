import type { PaperFamily } from '../lib/paper/paper.types';
import { buildRunRecipe, JPEG_QUALITY } from '../lib/recipe/buildRunRecipe';
import { INK_PALETTE } from '../lib/recipe/inkPalette';
import { createSheetSequence } from '../lib/recipe/pickSheetSequence';
import type { PageOpticsRecipe, RunRecipe } from '../lib/recipe/recipe.types';

/**
 * Оптика по умолчанию: те же значения, что выводит рецепт. Идёт в дело, когда
 * семья листов не выбрана и рецепта нет, — растеризовать страницу всё равно
 * нужно чем-то.
 */
const DEFAULT_OPTICS: PageOpticsRecipe = {
  jpegQuality: JPEG_QUALITY,
};

import type { GeneratorInk, GeneratorState } from './generator.types';
import { selectActiveFamily } from './paperSelectors';
import type { PageRecipeValues } from './recipeSelectors.types';

/**
 * Рецепт прогона по текущему состоянию. Выведен из `runSeed`, поэтому правка
 * текста его не меняет: чтобы рецепт стал другим, нужен новый прогон.
 *
 * Флаги и частоты побуквенной обработки рецепт копирует из реализма
 * документа, из seed выводится только seed почерка. Цвет чернил рецепт
 * выбирает сам, только если выбранного тона нет в палитре.
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

  const { flags, wordFrequency, letterFrequency } = state.realism;

  return buildRunRecipe({
    seed: state.runSeed,
    family,
    pageCount: Math.max(1, pageCount),
    flags,
    inkColor: resolveInkColor(state.ink),
    wordFrequency,
    letterFrequency,
  });
};

/**
 * Цвет, заданный выбором чернил вручную.
 *
 * @param ink — выбор чернил
 * @returns цвет тона или произвольный цвет; `null` — тона нет в палитре,
 *   цвет выбирает рецепт
 */
export const resolveInkColor = (ink: GeneratorInk): string | null => {
  switch (ink.kind) {
    case 'tone': {
      return (
        INK_PALETTE.find(({ id }) => {
          return id === ink.toneId;
        })?.color || null
      );
    }

    case 'custom': {
      return ink.color;
    }

    default: {
      throw new Error(`Неизвестный выбор чернил: ${JSON.stringify(ink)}`);
    }
  }
};

/**
 * Всё, что страница берёт из рецепта прогона, одним плоским снимком: цвет
 * чернил, почерк и качество кодирования. Плоский, чтобы подписка через
 * `useShallow` не видела нового значения, пока рецепт не изменился по сути:
 * сам рецепт собирается заново на каждый вызов.
 *
 * @param state — состояние генератора
 * @param pageCount — число страниц прогона
 * @returns величины рецепта для отрисовки страниц
 */
export const selectPageRecipe = (
  state: GeneratorState,
  pageCount: number
): PageRecipeValues => {
  const recipe = selectRunRecipe(state, pageCount);
  const { flags, wordFrequency, letterFrequency } = state.realism;

  if (!recipe) {
    return {
      inkColor: resolveInkColor(state.ink) || INK_PALETTE[0]?.color || '',
      handwritingSeed: state.runSeed,
      flags,
      wordFrequency,
      letterFrequency,
      jpegQuality: DEFAULT_OPTICS.jpegQuality,
    };
  }

  return {
    inkColor: recipe.inkColor,
    handwritingSeed: recipe.handwriting.seed,
    flags: recipe.handwriting.flags,
    wordFrequency: recipe.handwriting.wordFrequency,
    letterFrequency: recipe.handwriting.letterFrequency,
    jpegQuality: recipe.optics.jpegQuality,
  };
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
 * Листы страниц прогона одной раздачей: лист страницы `i` тот же, что отдаёт
 * `selectPageSheetId(state, i)`, но рецепт прогона не собирается — раздача
 * наращивается по мере запросов и запоминается. Проход по всем страницам
 * остаётся линейным, а число страниц заранее знать не нужно.
 *
 * Ручной выбор перебивает раздачу целиком — выбранный лист встаёт на все
 * страницы.
 *
 * @param selection — выбор экземпляра листа и seed прогона
 * @param family — выбранная семья; `null` — семьи нет, остаётся выбранный лист
 * @returns идентификатор экземпляра листа страницы по её номеру
 */
export const buildPageSheetSequence = (
  selection: Pick<GeneratorState, 'sheetId' | 'isSheetPinned' | 'runSeed'>,
  family: PaperFamily | null
): ((pageIndex: number) => string) => {
  const { sheetId, isSheetPinned, runSeed } = selection;

  if (isSheetPinned || !family) {
    return () => {
      return sheetId;
    };
  }

  const sheetAt = createSheetSequence(runSeed, family.sheets);

  return (pageIndex) => {
    return sheetAt(pageIndex).id;
  };
};
