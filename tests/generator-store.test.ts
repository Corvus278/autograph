import { DEFAULT_REALISM_LEVEL_ID, REALISM_LEVELS } from '@pages/Generator/config';
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

/**
 * Поля старой модели, которых в сторе быть не должно: абсолютная геометрия,
 * встроенный фон, seed искажений и пара «цвет + признак авто».
 */
const REMOVED_FIELDS = [
  'seed',
  'fontSize',
  'blockWidth',
  'lineSpacing',
  'topOffset',
  'leftPadding',
  'blockRotate',
  'backgroundId',
  'customBackgroundSrc',
  'selectBackground',
  'setCustomBackground',
  'inkColor',
  'isInkColorAuto',
  'flags',
  'wordFrequency',
  'letterFrequency',
  'hasContourVariance',
  'regenerate',
];

describe('значения по умолчанию', () => {
  it('совпадают с подобранными стартовыми значениями', () => {
    expect(store().bottomMargin).toBe(0);
    expect(store().sceneDarken).toBe(0.06);
  });

  it('открывают генератор с непустым текстом, выбранным шрифтом и чернилами «Авто»', () => {
    expect(store().text).not.toBe('');
    expect(store().fontFamily).toBe('Abram');
    expect(store().ink).toEqual({ kind: 'auto' });
  });

  it('открывают просмотр вписанным листом без разворота', () => {
    expect(store().pageIndex).toBe(0);
    expect(store().isSpread).toBe(false);
    expect(store().zoom).toBe('fit');
  });

  it('не содержат полей старой модели', () => {
    const state = store();

    REMOVED_FIELDS.forEach((field) => {
      expect(field in state, field).toBe(false);
    });
  });
});

describe('действия стора', () => {
  it('меняет текст', () => {
    store().setText('новый текст');

    expect(store().text).toBe('новый текст');
  });

  it('меняет шрифт', () => {
    store().setFontFamily('Eskal');

    expect(store().fontFamily).toBe('Eskal');
  });

  it('выбирает чернила тоном палитры и произвольным цветом', () => {
    store().setInk({ kind: 'tone', toneId: 'gel-black' });

    expect(store().ink).toEqual({ kind: 'tone', toneId: 'gel-black' });

    store().setInk({ kind: 'custom', color: '#0000ff' });

    expect(store().ink).toEqual({ kind: 'custom', color: '#0000ff' });

    store().setInk({ kind: 'auto' });

    expect(store().ink).toEqual({ kind: 'auto' });
  });

  it('ставит и сбрасывает свой шрифт', () => {
    store().setCustomFontFamily('UserFont');

    expect(store().customFontFamily).toBe('UserFont');

    store().setCustomFontFamily(null);

    expect(store().customFontFamily).toBeNull();
  });

  it('меняет запас снизу', () => {
    store().setGeometry({ bottomMargin: 2 });

    expect(store().bottomMargin).toBe(2);
  });

  it('включает режим «убрать фон»', () => {
    store().setBackgroundHidden(true);

    expect(store().isBackgroundHidden).toBe(true);
  });

  it('переключает вид искажений и делает реализм ручным', () => {
    store().selectRealismLevel('even');
    store().toggleDistortion('isWordRotated');

    expect(store().realism.flags.isWordRotated).toBe(true);
    expect(store().realism.flags.isWordSkewed).toBe(false);
    expect(store().realism.level).toBe('custom');

    store().toggleDistortion('isWordRotated');

    expect(store().realism.flags.isWordRotated).toBe(false);
  });

  it('переключает вариативность контуров букв', () => {
    expect(store().realism.hasContourVariance).toBe(true);

    store().setContourVariance(false);

    expect(store().realism.hasContourVariance).toBe(false);

    store().setContourVariance(true);

    expect(store().realism.hasContourVariance).toBe(true);
  });

  it('меняет частоты побуквенных искажений, не трогая флаги', () => {
    const { flags } = store().realism;

    store().setWordFrequency(3);
    store().setLetterFrequency(4);

    expect(store().realism.wordFrequency).toBe(3);
    expect(store().realism.letterFrequency).toBe(4);
    expect(store().realism.flags).toEqual(flags);
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

  it('включает разворот и меняет масштаб просмотра', () => {
    store().setIsSpread(true);
    store().setZoom(1.5);

    expect(store().isSpread).toBe(true);
    expect(store().zoom).toBe(1.5);

    store().setZoom('fit');

    expect(store().zoom).toBe('fit');
  });
});

describe('реализм', () => {
  it('по умолчанию выбран уровень «Обычно» с включёнными искажениями', () => {
    const { realism } = store();

    expect(realism.level).toBe(DEFAULT_REALISM_LEVEL_ID);
    expect(realism.level).toBe('normal');
    expect(Object.values(realism.flags).some(Boolean)).toBe(true);
  });

  it('ступень пишет в реализм свои значения', () => {
    REALISM_LEVELS.forEach((level) => {
      store().selectRealismLevel(level.id);

      expect(store().realism).toEqual({
        level: level.id,
        flags: level.flags,
        wordFrequency: level.wordFrequency,
        letterFrequency: level.letterFrequency,
        hasContourVariance: level.hasContourVariance,
      });
    });
  });

  it('«Ровно» выключает все искажения и вариативность контуров', () => {
    store().selectRealismLevel('even');

    expect(Object.values(store().realism.flags).some(Boolean)).toBe(false);
    expect(store().realism.hasContourVariance).toBe(false);
  });

  it('правка одного флага даёт «Свой» и не трогает остальные', () => {
    store().selectRealismLevel('normal');

    const { flags, wordFrequency, letterFrequency, hasContourVariance } = store().realism;

    store().toggleDistortion('isWordSkewed');

    expect(store().realism).toEqual({
      level: 'custom',
      flags: { ...flags, isWordSkewed: !flags.isWordSkewed },
      wordFrequency,
      letterFrequency,
      hasContourVariance,
    });
  });

  it('выбор ступени перезаписывает свою настройку', () => {
    store().toggleDistortion('isLetterFontRandom');
    store().setWordFrequency(5);
    store().selectRealismLevel('neat');

    expect(store().realism.level).toBe('neat');
    expect(store().realism.flags.isLetterFontRandom).toBe(false);
    expect(store().realism.wordFrequency).toBe(
      REALISM_LEVELS.find(({ id }) => {
        return id === 'neat';
      })?.wordFrequency
    );
  });
});

describe('seed прогона', () => {
  it('меняется по «Перегенерировать» — новому прогону', () => {
    const before = store().runSeed;

    store().startNewRun();

    expect(store().runSeed).not.toBe(before);
  });

  it('не меняется при смене уровня реализма', () => {
    const before = store().runSeed;

    store().selectRealismLevel('sloppy');
    store().selectRealismLevel('even');

    expect(store().runSeed).toBe(before);
  });

  it('не меняется при правке текста, реализма, чернил, страницы и просмотра', () => {
    const before = store().runSeed;

    store().setText('другой текст');
    store().toggleDistortion('isLineRotated');
    store().setWordFrequency(3);
    store().setInk({ kind: 'custom', color: '#ff0000' });
    store().goToPage(1);
    store().setZoom(2);
    store().setFontFamily('Lexa');

    expect(store().runSeed).toBe(before);
  });
});
