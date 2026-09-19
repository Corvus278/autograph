import type * as BuildRunRecipeModule from '@pages/Generator/lib/recipe/buildRunRecipe';
import { buildRunRecipe } from '@pages/Generator/lib/recipe/buildRunRecipe';
import { selectActiveFamily } from '@pages/Generator/model/paperSelectors';
import {
  buildPageSheetSequence,
  selectPageSheetId,
  selectRunRecipe,
} from '@pages/Generator/model/recipeSelectors';
import {
  DEFAULT_GENERATOR_STATE,
  useGeneratorStore,
} from '@pages/Generator/model/useGeneratorStore';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Сборка рецепта под шпионом: по числу вызовов видно, пересобирается ли рецепт
 * на каждой странице. Шпион зовёт настоящую сборку — состав рецепта не меняется.
 */
vi.mock('@pages/Generator/lib/recipe/buildRunRecipe', async (importOriginal) => {
  const actual = await importOriginal<typeof BuildRunRecipeModule>();

  return { ...actual, buildRunRecipe: vi.fn(actual.buildRunRecipe) };
});

/**
 * Длинный прогон: на нём пересборка рецепта на каждой странице дала бы
 * квадратичное число вызовов.
 */
const LONG_RUN_PAGE_COUNT = 50;

/**
 * Прогон на нескольких страницах: на одной странице совпадение рецептов ещё
 * ничего не значит — раздача листов по страницам видна только на пачке.
 */
const PAGE_COUNT = 4;

const store = () => {
  return useGeneratorStore.getState();
};

const recipe = () => {
  return selectRunRecipe(store(), PAGE_COUNT);
};

beforeEach(() => {
  useGeneratorStore.setState(DEFAULT_GENERATOR_STATE);
});

describe('состав рецепта', () => {
  it('раздаёт листы выбранной семьи по всем страницам', () => {
    const current = recipe();

    expect(current?.familyId).toBe('grid');
    expect(current?.pages).toHaveLength(PAGE_COUNT);
    expect(
      current?.pages.every((page) => {
        return page.sheetId.startsWith('grid-');
      })
    ).toBe(true);
  });

  it('берёт частоты искажений из настроек пользователя, а не из seed', () => {
    store().setWordFrequency(4);
    store().setLetterFrequency(5);

    expect(recipe()?.handwriting.wordFrequency).toBe(4);
    expect(recipe()?.handwriting.letterFrequency).toBe(5);
  });

  it('не меняет цвет чернил, заданный вручную', () => {
    store().setInk({ kind: 'custom', color: '#123456' });
    store().startNewRun();

    expect(recipe()?.inkColor).toBe('#123456');
  });

  it('берёт цвет чернил из палитры, пока пользователь его не задал', () => {
    expect(recipe()?.inkColor).toMatch(/^#[\da-f]{6}$/);
  });
});

describe('экземпляр листа страницы', () => {
  /**
   * Листы страниц прогона так, как их видит предпросмотр.
   *
   * @returns идентификаторы экземпляров по страницам
   */
  const pageSheetIds = (): string[] => {
    return Array.from({ length: PAGE_COUNT }, (_page, pageIndex) => {
      return selectPageSheetId(store(), pageIndex);
    });
  };

  it('предпросмотр берёт лист из рецепта, а не из выбора семьи', () => {
    const recipeSheetIds = recipe()?.pages.map(({ sheetId }) => {
      return sheetId;
    });

    expect(pageSheetIds()).toEqual(recipeSheetIds);
  });

  it('ручной выбор ставит один лист на все страницы', () => {
    store().selectSheet('grid-3');

    expect(store().isSheetPinned).toBe(true);
    expect(pageSheetIds()).toEqual(
      Array.from({ length: PAGE_COUNT }, () => {
        return 'grid-3';
      })
    );
  });

  it('смена семьи возвращает раздачу рецепту', () => {
    store().selectSheet('grid-3');
    store().selectFamily('lined');

    const recipeSheetIds = recipe()?.pages.map(({ sheetId }) => {
      return sheetId;
    });

    expect(store().isSheetPinned).toBe(false);
    expect(pageSheetIds()).toEqual(recipeSheetIds);
  });
});

describe('последовательность листов прогона', () => {
  /**
   * Листы длинного прогона из одной последовательности.
   *
   * @returns идентификаторы экземпляров по страницам
   */
  const sequenceSheetIds = (): string[] => {
    const sheetIdAt = buildPageSheetSequence(
      store(),
      selectActiveFamily(store()) || null
    );

    return Array.from({ length: LONG_RUN_PAGE_COUNT }, (_page, pageIndex) => {
      return sheetIdAt(pageIndex);
    });
  };

  /**
   * Листы длинного прогона, запрошенные у селектора страницы по одной.
   *
   * @returns идентификаторы экземпляров по страницам
   */
  const pageByPageSheetIds = (): string[] => {
    return Array.from({ length: LONG_RUN_PAGE_COUNT }, (_page, pageIndex) => {
      return selectPageSheetId(store(), pageIndex);
    });
  };

  it('совпадает с листом каждой страницы, запрошенным по отдельности', () => {
    expect(selectActiveFamily(store())?.sheets.length).toBeGreaterThanOrEqual(3);
    expect(sequenceSheetIds()).toEqual(pageByPageSheetIds());
  });

  it('с закреплённым листом ставит его на все страницы', () => {
    store().selectSheet('grid-3');

    expect(sequenceSheetIds()).toEqual(pageByPageSheetIds());
    expect(new Set(sequenceSheetIds())).toEqual(new Set(['grid-3']));
  });

  it('не пересобирает рецепт на каждой странице', () => {
    const buildRunRecipeSpy = vi.mocked(buildRunRecipe);

    buildRunRecipeSpy.mockClear();
    pageByPageSheetIds();

    /**
     * Шпион видит сборки: селектор страницы собирает рецепт на каждый вызов.
     */
    expect(buildRunRecipeSpy).toHaveBeenCalledTimes(LONG_RUN_PAGE_COUNT);

    buildRunRecipeSpy.mockClear();
    sequenceSheetIds();

    expect(buildRunRecipeSpy.mock.calls.length).toBeLessThanOrEqual(1);
  });
});

describe('правка текста', () => {
  it('рецепт не меняет', () => {
    const before = recipe();

    store().setText('дописанное предложение');

    expect(recipe()).toEqual(before);
  });

  it('оставляет прежними и листы, и цвет чернил', () => {
    const before = recipe();

    store().setText('ещё одно предложение');

    expect(recipe()?.pages).toEqual(before?.pages);
    expect(recipe()?.inkColor).toBe(before?.inkColor);
  });
});

describe('новый прогон', () => {
  it('формирует рецепт заново', () => {
    const before = recipe();

    store().startNewRun();

    expect(store().runSeed).not.toBe(DEFAULT_GENERATOR_STATE.runSeed);
    expect(recipe()).not.toEqual(before);
  });

  it('меняет рисунок почерка, а не только seed прогона', () => {
    const before = recipe();

    store().startNewRun();

    expect(recipe()?.handwriting.seed).not.toBe(before?.handwriting.seed);
  });

  it('повторяется на том же seed прогона', () => {
    const before = recipe();

    store().startNewRun();
    useGeneratorStore.setState({ runSeed: DEFAULT_GENERATOR_STATE.runSeed });

    expect(recipe()).toEqual(before);
  });
});
