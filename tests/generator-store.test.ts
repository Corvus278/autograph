import {
  DEFAULT_GENERATOR_STATE,
  useGeneratorStore,
} from '@pages/Generator/model/useGeneratorStore';
import { beforeEach, describe, expect, it } from 'vitest';

/**
 * Стор объявлен вне React, поэтому проверяется вызовами напрямую — без рендера
 * дерева.
 */
const store = () => {
  return useGeneratorStore.getState();
};

beforeEach(() => {
  useGeneratorStore.setState(DEFAULT_GENERATOR_STATE);
});

describe('значения по умолчанию', () => {
  it('совпадают с подобранными стартовыми значениями слайдеров', () => {
    expect(store().fontSize).toBe(1.6);
    expect(store().blockWidth).toBe(446);
    expect(store().lineSpacing).toBe(-2);
    expect(store().topOffset).toBe(5);
    expect(store().leftPadding).toBe(5);
    expect(store().blockRotate).toBe(0);
    expect(store().bottomMargin).toBe(0);
    expect(store().wordFrequency).toBe(1);
    expect(store().letterFrequency).toBe(1);
    expect(store().sceneDarken).toBe(0.06);
  });

  it('открывают генератор с непустым текстом и выбранным шрифтом', () => {
    expect(store().text).not.toBe('');
    expect(store().fontFamily).toBe('Abram');
    expect(store().backgroundId).toBe('grid');
  });
});

describe('действия стора', () => {
  it('меняет текст', () => {
    store().setText('новый текст');

    expect(store().text).toBe('новый текст');
  });

  it('меняет шрифт и цвет чернил', () => {
    store().setFontFamily('Eskal');
    store().setInkColor('#0000ff');

    expect(store().fontFamily).toBe('Eskal');
    expect(store().inkColor).toBe('#0000ff');
  });

  it('ставит и сбрасывает свой шрифт', () => {
    store().setCustomFontFamily('UserFont');

    expect(store().customFontFamily).toBe('UserFont');

    store().setCustomFontFamily(null);

    expect(store().customFontFamily).toBeNull();
  });

  it('меняет геометрию блока текста', () => {
    store().setGeometry({ fontSize: 2.4, blockWidth: 500 });

    expect(store().fontSize).toBe(2.4);
    expect(store().blockWidth).toBe(500);
  });

  it('сбрасывает загруженный фон при выборе встроенного', () => {
    store().setCustomBackground('data:image/png;base64,aaa');
    store().selectBackground('lined');

    expect(store().backgroundId).toBe('lined');
    expect(store().customBackgroundSrc).toBeNull();
  });

  it('включает режим «убрать фон»', () => {
    store().setBackgroundHidden(true);

    expect(store().isBackgroundHidden).toBe(true);
  });

  it('переключает вид искажений', () => {
    store().toggleDistortion('isWordRotated');

    expect(store().flags.isWordRotated).toBe(true);
    expect(store().flags.isWordSkewed).toBe(false);

    store().toggleDistortion('isWordRotated');

    expect(store().flags.isWordRotated).toBe(false);
  });

  it('переключает вариативность контуров букв', () => {
    expect(useGeneratorStore.getState().hasContourVariance).toBe(true);

    useGeneratorStore.getState().setContourVariance(false);

    expect(useGeneratorStore.getState().hasContourVariance).toBe(false);

    useGeneratorStore.getState().setContourVariance(true);

    expect(useGeneratorStore.getState().hasContourVariance).toBe(true);
  });

  it('меняет частоты побуквенных искажений', () => {
    store().setWordFrequency(3);
    store().setLetterFrequency(4);

    expect(store().wordFrequency).toBe(3);
    expect(store().letterFrequency).toBe(4);
  });

  it('сбрасывает загруженную сцену при выборе встроенной', () => {
    store().setCustomScene('data:image/png;base64,aaa');
    store().selectScene('notebook');

    expect(store().sceneId).toBe('notebook');
    expect(store().customSceneSrc).toBeNull();
  });

  it('меняет параметры вложения в сцену', () => {
    store().setSceneParams({ sceneRotate: 5, hasSceneShadow: true });

    expect(store().sceneRotate).toBe(5);
    expect(store().hasSceneShadow).toBe(true);
  });

  it('переключает страницы и не уходит в отрицательные номера', () => {
    store().goToPage(2);

    expect(store().pageIndex).toBe(2);

    store().goToPage(-1);

    expect(store().pageIndex).toBe(0);
  });

  it('приводит номер страницы к новому числу страниц', () => {
    store().goToPage(5);
    store().clampPageIndex(3);

    expect(store().pageIndex).toBe(2);

    store().clampPageIndex(0);

    expect(store().pageIndex).toBe(0);
  });
});

describe('seed случайных искажений', () => {
  it('меняется при правке текста', () => {
    const before = store().seed;

    store().setText('другой текст');

    expect(store().seed).not.toBe(before);
  });

  it('меняется при переключении искажения', () => {
    const before = store().seed;

    store().toggleDistortion('isLineRotated');

    expect(store().seed).not.toBe(before);
  });

  it('меняется по «Перегенерировать»', () => {
    const before = store().seed;

    store().regenerate();

    expect(store().seed).not.toBe(before);
  });

  it('не меняется при переключении страницы и правке геометрии', () => {
    const before = store().seed;

    store().goToPage(1);
    store().setGeometry({ fontSize: 3 });
    store().setFontFamily('Lexa');

    expect(store().seed).toBe(before);
  });
});
