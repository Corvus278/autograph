import type { InkRgb } from '@pages/Generator/lib/ink/ink.types';
import {
  buildInkFragmentShader,
  resolveInkLighting,
} from '@pages/Generator/lib/ink/inkShader';
import {
  INK_MODULATION_DEFAULTS,
  inkGain,
  modulateInkSample,
  NEUTRAL_TEXTURE_VALUE,
} from '@pages/Generator/lib/ink/modulateInkSample';
import { sampleLightingField } from '@pages/Generator/lib/ink/sampleLightingField';
import type { LightingField } from '@pages/Generator/lib/paper/paper.types';
import { describe, expect, it } from 'vitest';

/**
 * Синие чернила шариковой ручки — самый частый цвет в тетради.
 */
const INK: InkRgb = { red: 31, green: 58, blue: 147 };

/**
 * Ровная бумага: текстура не вмешивается, работает одно освещение.
 */
const FLAT_TEXTURE = NEUTRAL_TEXTURE_VALUE;

/**
 * Лист, у которого левая часть освещена слабее правой. Значения нормированы
 * на самый светлый узел — как у настоящего поля.
 */
const GRADIENT_FIELD: LightingField = {
  gridWidth: 3,
  gridHeight: 2,
  values: [0.6, 0.8, 1, 0.6, 0.8, 1],
  contrast: 0.4,
  isUsable: true,
};

/**
 * Поле равномерно освещённого источника: скан, по которому модулировать
 * нечего.
 */
const FLAT_FIELD: LightingField = {
  gridWidth: 4,
  gridHeight: 4,
  values: Array.from({ length: 16 }, () => {
    return 1;
  }),
  contrast: 0,
  isUsable: false,
};

/**
 * Яркость цвета: по ней сравнивают, какие чернила темнее.
 */
const luminanceOf = ({ red, green, blue }: InkRgb): number => {
  return 0.299 * red + 0.587 * green + 0.114 * blue;
};

describe('modulateInkSample', () => {
  it('в слабо освещённой части листа чернила темнее, чем в ярко освещённой', () => {
    const dark = sampleLightingField(GRADIENT_FIELD, 0, 0.5);
    const bright = sampleLightingField(GRADIENT_FIELD, 1, 0.5);

    const inkInShadow = modulateInkSample(INK, dark, FLAT_TEXTURE);
    const inkInLight = modulateInkSample(INK, bright, FLAT_TEXTURE);

    expect(luminanceOf(inkInShadow)).toBeLessThan(luminanceOf(inkInLight));
    expect(inkInShadow.red).toBeLessThan(inkInLight.red);
    expect(inkInShadow.green).toBeLessThan(inkInLight.green);
    expect(inkInShadow.blue).toBeLessThan(inkInLight.blue);
  });

  it('текстура даёт локальные отклонения: соседние пиксели различаются', () => {
    const lighting = sampleLightingField(GRADIENT_FIELD, 0.5, 0.5);

    const inPit = modulateInkSample(INK, lighting, -0.7);
    const onFibre = modulateInkSample(INK, lighting, 0.4);

    expect(luminanceOf(inPit)).toBeLessThan(luminanceOf(onFibre));
    expect(inPit.blue).not.toBeCloseTo(onFibre.blue, 3);
  });

  it('формула детерминирована', () => {
    const first = modulateInkSample(INK, 0.73, -0.21);
    const second = modulateInkSample(INK, 0.73, -0.21);

    expect(first).toEqual(second);
  });

  it('цвет не светлее исходного и не уходит в чёрный', () => {
    const { minGain } = INK_MODULATION_DEFAULTS;
    const levels = [-1, 0, 0.25, 0.5, 0.75, 1, 2];

    for (const lighting of levels) {
      for (const texture of levels) {
        const sample = modulateInkSample(INK, lighting, texture);

        expect(sample.red).toBeLessThanOrEqual(INK.red);
        expect(sample.green).toBeLessThanOrEqual(INK.green);
        expect(sample.blue).toBeLessThanOrEqual(INK.blue);
        expect(sample.red).toBeGreaterThanOrEqual(INK.red * minGain);
        expect(sample.green).toBeGreaterThanOrEqual(INK.green * minGain);
        expect(sample.blue).toBeGreaterThanOrEqual(INK.blue * minGain);
      }
    }
  });

  it('самая светлая часть ровного листа оставляет цвет как есть', () => {
    expect(modulateInkSample(INK, 1, NEUTRAL_TEXTURE_VALUE)).toEqual(INK);
  });

  it('коэффициенты меняют силу модуляции', () => {
    const weak = inkGain(0.5, FLAT_TEXTURE, { lightInfluence: 0.1 });
    const strong = inkGain(0.5, FLAT_TEXTURE, { lightInfluence: 0.5 });

    expect(strong).toBeLessThan(weak);
  });
});

describe('sampleLightingField', () => {
  it('в узле сетки совпадает со значением узла', () => {
    expect(sampleLightingField(GRADIENT_FIELD, 0, 0)).toBeCloseTo(0.6, 10);
    expect(sampleLightingField(GRADIENT_FIELD, 0.5, 0)).toBeCloseTo(0.8, 10);
    expect(sampleLightingField(GRADIENT_FIELD, 1, 1)).toBeCloseTo(1, 10);
  });

  it('между узлами возвращает промежуточное значение', () => {
    const between = sampleLightingField(GRADIENT_FIELD, 0.25, 0.5);

    expect(between).toBeGreaterThan(0.6);
    expect(between).toBeLessThan(0.8);
    expect(between).toBeCloseTo(0.7, 10);
  });

  it('за границей листа не выходит за диапазон поля', () => {
    const values = [
      sampleLightingField(GRADIENT_FIELD, -3, 0.5),
      sampleLightingField(GRADIENT_FIELD, 4, 0.5),
      sampleLightingField(GRADIENT_FIELD, 0.5, -2),
      sampleLightingField(GRADIENT_FIELD, 0.5, 9),
    ];

    for (const value of values) {
      expect(value).toBeGreaterThanOrEqual(0.6);
      expect(value).toBeLessThanOrEqual(1);
    }

    expect(sampleLightingField(GRADIENT_FIELD, -3, 0.5)).toBeCloseTo(0.6, 10);
    expect(sampleLightingField(GRADIENT_FIELD, 4, 0.5)).toBeCloseTo(1, 10);
  });

  it('пустое поле даёт нейтральное освещение', () => {
    const empty: LightingField = {
      gridWidth: 0,
      gridHeight: 0,
      values: [],
      contrast: 0,
      isUsable: false,
    };

    expect(sampleLightingField(empty, 0.5, 0.5)).toBe(1);
  });
});

describe('resolveInkLighting', () => {
  it('пригодное поле берётся как есть', () => {
    expect(resolveInkLighting(GRADIENT_FIELD, 400, 600, 7)).toBe(GRADIENT_FIELD);
  });

  it('при непригодном поле чернила не остаются равномерными', () => {
    const field = resolveInkLighting(FLAT_FIELD, 400, 600, 7);
    const samples: number[] = [];

    for (let row = 0; row <= 4; row += 1) {
      for (let column = 0; column <= 4; column += 1) {
        const lighting = sampleLightingField(field, column / 4, row / 4);

        samples.push(luminanceOf(modulateInkSample(INK, lighting, FLAT_TEXTURE)));
      }
    }

    const darkest = Math.min(...samples);
    const brightest = Math.max(...samples);

    expect(field.isUsable).toBe(true);
    expect(brightest - darkest).toBeGreaterThan(1);
  });

  it('отсутствие поля тоже заменяется синтетическим', () => {
    const field = resolveInkLighting(null, 400, 600, 3);

    expect(field.isUsable).toBe(true);
    expect(field.contrast).toBeGreaterThan(0);
  });

  it('синтетическое освещение выводится из seed', () => {
    const first = resolveInkLighting(null, 400, 600, 11);
    const second = resolveInkLighting(null, 400, 600, 11);
    const other = resolveInkLighting(null, 400, 600, 12);

    expect(first.values).toEqual(second.values);
    expect(first.values).not.toEqual(other.values);
  });
});

describe('buildInkFragmentShader', () => {
  /**
   * Шейдер считает по той же формуле, что и `modulateInkSample`, но проверить
   * это юнит-тестом нельзя: для прохода нужен WebGL. Тест держит хотя бы
   * коэффициенты — их расхождение с CPU-формулой сразу разводит предпросмотр и
   * экспорт.
   */
  const constantOf = (source: string, name: string): number => {
    const match = new RegExp(`const float ${name} = ([-0-9.]+);`).exec(source);

    return Number(match?.[1]);
  };

  it('константы шейдера совпадают с коэффициентами CPU-формулы', () => {
    const source = buildInkFragmentShader();
    const { lightInfluence, textureInfluence, minGain } = INK_MODULATION_DEFAULTS;

    expect(constantOf(source, 'LIGHT_INFLUENCE')).toBe(lightInfluence);
    expect(constantOf(source, 'TEXTURE_INFLUENCE')).toBe(textureInfluence);
    expect(constantOf(source, 'MIN_GAIN')).toBe(minGain);
    expect(constantOf(source, 'NEUTRAL_TEXTURE')).toBe(NEUTRAL_TEXTURE_VALUE);
  });

  it('переданные коэффициенты подставляются в текст шейдера', () => {
    const source = buildInkFragmentShader({ lightInfluence: 0.5, minGain: 0.25 });

    expect(constantOf(source, 'LIGHT_INFLUENCE')).toBe(0.5);
    expect(constantOf(source, 'MIN_GAIN')).toBe(0.25);
    expect(constantOf(source, 'TEXTURE_INFLUENCE')).toBe(
      INK_MODULATION_DEFAULTS.textureInfluence
    );
  });

  it('целые коэффициенты записаны литералом float', () => {
    expect(buildInkFragmentShader({ minGain: 0 })).toContain(
      'const float MIN_GAIN = 0.0;'
    );
  });
});
