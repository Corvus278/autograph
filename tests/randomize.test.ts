import { buildDistortions } from '@pages/Generator/lib/randomize/buildDistortions';
import { buildLineDistortions } from '@pages/Generator/lib/randomize/buildLineDistortions';
import type {
  BuildDistortionsOptions,
  DistortionFlags,
} from '@pages/Generator/lib/randomize/randomize.types';
import { describe, expect, it } from 'vitest';

const NO_FLAGS: DistortionFlags = {
  isWordRotated: false,
  isWordSkewed: false,
  isWordShifted: false,
  isLetterSpacingRandom: false,
  isLetterFontRandom: false,
  isLineRotated: false,
  isLineShifted: false,
};

/**
 * Частота слов 1 — побуквенная обработка достаётся каждому подходящему слову,
 * так проверки не зависят от того, какое число выпало.
 */
const buildOptions = (
  flags: Partial<DistortionFlags>,
  overrides: Partial<BuildDistortionsOptions> = {}
): BuildDistortionsOptions => {
  return {
    flags: { ...NO_FLAGS, ...flags },
    wordFrequency: 1,
    letterFrequency: 5,
    seed: 42,
    substituteFonts: ['Eskal', 'Lexa'],
    ...overrides,
  };
};

const WORDS = ['рукописный', 'текст', 'из', 'слов'];

describe('buildDistortions', () => {
  it('при всех выключенных флагах не искажает ничего', () => {
    const distortions = buildDistortions(WORDS, buildOptions({}));

    expect(distortions).toEqual(
      WORDS.map(() => {
        return { rotate: 0, skew: 0, translateY: 0, letters: [] };
      })
    );
  });

  it('поворачивает слова только при своём флаге', () => {
    const distortions = buildDistortions(WORDS, buildOptions({ isWordRotated: true }));

    expect(
      distortions.some(({ rotate }) => {
        return rotate !== 0;
      })
    ).toBe(true);
    expect(
      distortions.every(({ skew, translateY }) => {
        return skew === 0 && translateY === 0;
      })
    ).toBe(true);
  });

  it('скашивает слова только при своём флаге', () => {
    const distortions = buildDistortions(WORDS, buildOptions({ isWordSkewed: true }));

    expect(
      distortions.some(({ skew }) => {
        return skew !== 0;
      })
    ).toBe(true);
    expect(
      distortions.every(({ rotate, translateY }) => {
        return rotate === 0 && translateY === 0;
      })
    ).toBe(true);
  });

  it('сдвигает слова по вертикали только при своём флаге', () => {
    const distortions = buildDistortions(WORDS, buildOptions({ isWordShifted: true }));

    expect(
      distortions.some(({ translateY }) => {
        return translateY !== 0;
      })
    ).toBe(true);
    expect(
      distortions.every(({ rotate, skew }) => {
        return rotate === 0 && skew === 0;
      })
    ).toBe(true);
  });

  it('меняет расстояние между буквами только при своём флаге', () => {
    const distortions = buildDistortions(
      WORDS,
      buildOptions({ isLetterSpacingRandom: true })
    );
    const letters = distortions.flatMap(({ letters: wordLetters }) => {
      return wordLetters;
    });

    expect(letters.length).toBeGreaterThan(0);
    expect(
      letters.every(({ fontFamily }) => {
        return fontFamily === null;
      })
    ).toBe(true);
  });

  it('подменяет шрифт буквы только на шрифты из списка', () => {
    const distortions = buildDistortions(
      WORDS,
      buildOptions({ isLetterFontRandom: true })
    );
    const letters = distortions.flatMap(({ letters: wordLetters }) => {
      return wordLetters;
    });

    expect(letters.length).toBeGreaterThan(0);
    expect(
      letters.every(({ fontFamily }) => {
        return fontFamily === 'Eskal' || fontFamily === 'Lexa';
      })
    ).toBe(true);
    expect(
      letters.every(({ letterSpacing }) => {
        return letterSpacing === null;
      })
    ).toBe(true);
  });

  it('не трогает слова короче трёх символов', () => {
    const distortions = buildDistortions(
      ['из'],
      buildOptions({ isLetterSpacingRandom: true })
    );

    expect(distortions[0]?.letters).toEqual([]);
  });

  it('искажает не больше указанного числа букв', () => {
    const distortions = buildDistortions(
      ['рукописный'],
      buildOptions({ isLetterSpacingRandom: true }, { letterFrequency: 2 })
    );

    expect(distortions[0]?.letters.length).toBeLessThanOrEqual(2);
  });

  it('на одном seed повторяет рисунок, на другом — меняет', () => {
    const flags = { isWordRotated: true, isWordSkewed: true };
    const first = buildDistortions(WORDS, buildOptions(flags));
    const same = buildDistortions(WORDS, buildOptions(flags));
    const other = buildDistortions(WORDS, buildOptions(flags, { seed: 43 }));

    expect(first).toEqual(same);
    expect(first).not.toEqual(other);
  });
});

describe('buildLineDistortions', () => {
  it('при выключенных построчных флагах отдаёт пустые описания', () => {
    const distortions = buildLineDistortions(3, { flags: NO_FLAGS, seed: 42 });

    expect(distortions).toEqual([
      { rotate: 0, translateX: 0 },
      { rotate: 0, translateX: 0 },
      { rotate: 0, translateX: 0 },
    ]);
  });

  it('роняет строки только при флаге «съезд линий»', () => {
    const distortions = buildLineDistortions(20, {
      flags: { ...NO_FLAGS, isLineRotated: true },
      seed: 42,
    });

    expect(
      distortions.some(({ rotate }) => {
        return rotate !== 0;
      })
    ).toBe(true);
    expect(
      distortions.every(({ translateX }) => {
        return translateX === 0;
      })
    ).toBe(true);
  });

  it('сдвигает строки по горизонтали только при своём флаге', () => {
    const distortions = buildLineDistortions(20, {
      flags: { ...NO_FLAGS, isLineShifted: true },
      seed: 42,
    });

    expect(
      distortions.some(({ translateX }) => {
        return translateX !== 0;
      })
    ).toBe(true);
    expect(
      distortions.every(({ rotate }) => {
        return rotate === 0;
      })
    ).toBe(true);
  });
});
