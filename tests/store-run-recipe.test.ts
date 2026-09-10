import {
  selectPageSheetId,
  selectRunRecipe,
} from '@pages/Generator/model/recipeSelectors';
import {
  DEFAULT_GENERATOR_STATE,
  useGeneratorStore,
} from '@pages/Generator/model/useGeneratorStore';
import { beforeEach, describe, expect, it } from 'vitest';

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
    store().setInkColor('#123456');
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
