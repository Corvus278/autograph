import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import type {
  ContourClassification,
  GlyphOutline,
  GlyphPathCommand,
  GlyphPoint,
  GlyphSource,
} from '@pages/Generator/lib/glyph';
import {
  classifyContours,
  createGlyphSource,
  DEFAULT_DEFORM_AMPLITUDE,
  deformGlyphPath,
  listOnCurvePoints,
  splitContours,
} from '@pages/Generator/lib/glyph';
import { describe, expect, it } from 'vitest';

import { inkContactArea, placeWord } from './helpers/glyph-raster';

/**
 * Связные шрифты пака: на них проверяется, что деформация не рвёт соединения.
 */
const CONNECTED_FAMILIES = [
  'Lexa',
  'Capuletty',
  'Montekky',
  'Paris',
  'Salavat',
  'Eskal',
  'Djiovanni',
];

/**
 * Слова, на которых ревью ловило разрывы соединений.
 */
const JOIN_WORDS = ['зубр', 'дублирую', 'письмо', 'шишка', 'ёлка', 'ох', 'хо'];

/**
 * Шаг seed между соседними буквами слова: у каждого вхождения буквы свой почерк.
 */
const SEED_STEP = 7919;

/**
 * Площадь смыкания в пикселях растра, начиная с которой стык считается
 * надёжным. Стык тоньше — волосяное касание: чернила соседних букв в исходном
 * шрифте перекрываются на площадь меньше квадрата в две сотых em, и разойтись
 * они могут от любого возмущения, хоть от округления при растеризации.
 */
const ROBUST_JOIN_AREA = 16;

const ALPHABET = [...'абвгдеёжзийклмнопрстуфхцчшщъыьэюя'];

/**
 * Seed вариативности фиксированы: иначе прогон то ловит разрыв, то нет.
 */
const SEEDS = [1, 12_345, 987_654];

/**
 * Деформированный экземпляр буквы вместе с разбором её контуров.
 */
type DeformedGlyph = {
  /**
   * Описание глифа из шрифта.
   */
  glyph: GlyphOutline;

  /**
   * Разделение контуров на тело и знаки.
   */
  classification: ContourClassification;

  /**
   * Точки на кривой по контурам до деформации.
   */
  before: GlyphPoint[][];

  /**
   * Точки на кривой по контурам после деформации.
   */
  after: GlyphPoint[][];
};

/**
 * Точка глифа с адресом: индекс контура и индекс точки внутри контура.
 */
type AddressedPoint = {
  /**
   * Сама точка.
   */
  point: GlyphPoint;

  /**
   * Индекс контура.
   */
  contourIndex: number;

  /**
   * Индекс точки внутри контура.
   */
  pointIndex: number;
};

/**
 * Смыкание чернил соседних глифов.
 */
type JoinContact = {
  /**
   * Площадь смыкания в пикселях растра. Ноль — чернила разошлись.
   */
  area: number;
};

/**
 * Итог проверки стыков.
 */
type JoinReport = {
  /**
   * Описания разорванных стыков.
   */
  broken: string[];

  /**
   * Сколько стыков проверено.
   */
  total: number;
};

/**
 * Допуск сравнения смещений в единицах шрифта. Смещение восстанавливается
 * вычитанием координат, а `(y + d) - y` в двоичных дробях не равно `d` в
 * последних разрядах.
 */
const SHIFT_EPSILON = 1e-9;

const sources = new Map<string, GlyphSource>();

/**
 * Источник контуров шрифта из `public/fonts`.
 */
const loadSource = (family: string): GlyphSource => {
  const cached = sources.get(family);

  if (cached) {
    return cached;
  }

  const path = fileURLToPath(new URL(`../public/fonts/${family}.ttf`, import.meta.url));
  const source = createGlyphSource(new Uint8Array(readFileSync(path)).buffer);

  sources.set(family, source);

  return source;
};

/**
 * Контуры буквы. Бросает, если буквы в шрифте нет: тест на отсутствующем глифе
 * проверял бы не то, что заявлено.
 */
const takeGlyph = (family: string, char: string): GlyphOutline => {
  const glyph = loadSource(family).getGlyph(char);

  if (!glyph) {
    throw new Error(`В шрифте ${family} нет глифа «${char}»`);
  }

  return glyph;
};

/**
 * Точки контуров, лежащие на кривой, по контурам.
 */
const onCurveByContour = (contours: readonly GlyphPathCommand[][]): GlyphPoint[][] => {
  return contours.map((contour) => {
    return contour.reduce<GlyphPoint[]>((acc, command) => {
      acc.push(...listOnCurvePoints(command));

      return acc;
    }, []);
  });
};

/**
 * Деформирует букву и раскладывает результат по контурам.
 */
const deformGlyph = (family: string, char: string, seed: number): DeformedGlyph => {
  const source = loadSource(family);
  const glyph = takeGlyph(family, char);
  const contours = splitContours(glyph.commands);
  const deformed = deformGlyphPath(glyph.commands, {
    unitsPerEm: source.unitsPerEm,
    advanceWidth: glyph.advanceWidth,
    seed,
  });

  return {
    glyph,
    classification: classifyContours(contours),
    before: onCurveByContour(contours),
    after: onCurveByContour(splitContours(deformed)),
  };
};

/**
 * Смещение точки по её адресу. Индексы совпадают: деформация сохраняет и
 * порядок контуров, и порядок команд.
 */
const shiftAt = (
  { before, after }: DeformedGlyph,
  contourIndex: number,
  pointIndex: number
): GlyphPoint => {
  const from = before[contourIndex]?.[pointIndex];
  const to = after[contourIndex]?.[pointIndex];

  if (!from || !to) {
    throw new Error(`Нет точки ${contourIndex}:${pointIndex} в одном из путей`);
  }

  return { x: to.x - from.x, y: to.y - from.y };
};

/**
 * Точки перечисленных контуров с их адресами.
 */
const addressPoints = (
  points: readonly GlyphPoint[][],
  contourIndexes: readonly number[]
): AddressedPoint[] => {
  return points.reduce<AddressedPoint[]>((acc, contour, contourIndex) => {
    if (contourIndexes.includes(contourIndex)) {
      for (const [pointIndex, point] of contour.entries()) {
        acc.push({ point, contourIndex, pointIndex });
      }
    }

    return acc;
  }, []);
};

/**
 * Стыки слова: пары соседних глифов, чернила которых в исходном шрифте
 * соприкасаются, с площадью их смыкания в пикселях растра.
 */
const listJoins = (family: string, word: string, seed: number | null): JoinContact[] => {
  const source = loadSource(family);
  const glyphs = placeWord(source, word, (glyph, index) => {
    return seed === null
      ? [...glyph.commands]
      : deformGlyphPath(glyph.commands, {
          unitsPerEm: source.unitsPerEm,
          advanceWidth: glyph.advanceWidth,
          seed: seed + index * SEED_STEP,
        });
  });

  return glyphs.reduce<JoinContact[]>((acc, glyph, index) => {
    const next = glyphs[index + 1];

    if (next) {
      acc.push({ area: inkContactArea([glyph], [next], source.unitsPerEm) });
    }

    return acc;
  }, []);
};

/**
 * Стыки, которые деформация разорвала: смыкание было, а после — нет.
 *
 * @param minArea — какую площадь смыкания в исходном шрифте считать надёжной
 * @param seamRamp — ширина рампы гашения; `null` — с настройкой по умолчанию
 * @returns описания разорванных стыков и их общее число
 */
const countBrokenJoins = (minArea: number): JoinReport => {
  const report: JoinReport = { broken: [], total: 0 };

  for (const family of CONNECTED_FAMILIES) {
    const words = [
      ...ALPHABET.flatMap((char) => {
        return [`${char}о`, `о${char}`];
      }),
      ...JOIN_WORDS,
    ];

    for (const word of words) {
      const plain = listJoins(family, word, null);

      for (const seed of SEEDS) {
        const deformed = listJoins(family, word, seed);

        for (const [index, join] of plain.entries()) {
          if (join.area < minArea) {
            continue;
          }

          report.total += 1;

          const after = deformed[index];

          if (!after) {
            throw new Error(`У деформированного «${word}» пропал стык ${index + 1}`);
          }

          if (after.area === 0) {
            report.broken.push(`${family} «${word}» seed ${seed}, стык ${index + 1}`);
          }
        }
      }
    }
  }

  return report;
};

describe('deformGlyphPath', () => {
  it('даёт разным вхождениям одной буквы разные контуры', () => {
    const glyph = takeGlyph('Salavat', 'о');
    const options = { unitsPerEm: 1000, advanceWidth: glyph.advanceWidth };

    const first = deformGlyphPath(glyph.commands, { ...options, seed: 1 });
    const second = deformGlyphPath(glyph.commands, { ...options, seed: 2 });

    expect(first).not.toEqual(glyph.commands);
    expect(second).not.toEqual(first);
  });

  it('повторяет контур при том же seed', () => {
    const glyph = takeGlyph('Salavat', 'о');
    const options = { unitsPerEm: 1000, advanceWidth: glyph.advanceWidth, seed: 42 };

    expect(deformGlyphPath(glyph.commands, options)).toEqual(
      deformGlyphPath(glyph.commands, options)
    );
  });

  it('не трогает исходные контуры', () => {
    const glyph = takeGlyph('Salavat', 'ё');
    const snapshot = structuredClone(glyph.commands);

    deformGlyphPath(glyph.commands, {
      unitsPerEm: 1000,
      advanceWidth: glyph.advanceWidth,
      seed: 3,
    });

    expect(glyph.commands).toEqual(snapshot);
  });

  it('на нулевой амплитуде отдаёт исходный контур', () => {
    const glyph = takeGlyph('Salavat', 'п');

    expect(
      deformGlyphPath(glyph.commands, {
        unitsPerEm: 1000,
        advanceWidth: glyph.advanceWidth,
        seed: 5,
        amplitude: 0,
      })
    ).toEqual([...glyph.commands]);
  });

  it('держит букву узнаваемой: точка не уезжает дальше амплитуды', () => {
    for (const family of CONNECTED_FAMILIES) {
      const source = loadSource(family);
      const deformed = deformGlyph(family, 'м', 11);
      const shifts = deformed.before.flatMap((points, contourIndex) => {
        return points.map((_point, pointIndex) => {
          return shiftAt(deformed, contourIndex, pointIndex);
        });
      });
      const maxShift = shifts.reduce((acc, shift) => {
        return Math.max(acc, Math.abs(shift.x), Math.abs(shift.y));
      }, 0);

      expect({ family, isVisible: maxShift > 0 }).toEqual({ family, isVisible: true });
      expect(maxShift).toBeLessThanOrEqual(0.014 * source.unitsPerEm);
    }
  });
});

describe('фиксация стыка', () => {
  /**
   * Проверка не разбирает формулу гашения, а смотрит на наблюдаемое свойство:
   * чернила, которыми буква накрывает соседа, не двигаются. Это чернила за
   * границами продвижения глифа — там, где соседняя буква уже начинается.
   */
  it('не двигает чернила тела за границами продвижения глифа', () => {
    const moved = CONNECTED_FAMILIES.flatMap((family) => {
      return ALPHABET.flatMap((char) => {
        const deformed = deformGlyph(family, char, 77);
        const { advanceWidth } = deformed.glyph;
        const { bodyIndexes } = deformed.classification;

        return addressPoints(deformed.before, bodyIndexes).reduce<string[]>(
          (acc, entry) => {
            const isOutside = entry.point.x < 0 || entry.point.x > advanceWidth;
            const shift = shiftAt(deformed, entry.contourIndex, entry.pointIndex);

            if (isOutside && Math.hypot(shift.x, shift.y) > 1e-9) {
              acc.push(
                `${family} «${char}» точка ${entry.contourIndex}:${entry.pointIndex}`
              );
            }

            return acc;
          },
          []
        );
      });
    });

    expect(moved).toEqual([]);
  });

  it('оставляет вариативность заметной по всему алфавиту', () => {
    const report = CONNECTED_FAMILIES.map((family) => {
      const shifts = ALPHABET.map((char) => {
        const deformed = deformGlyph(family, char, 5);
        const points = deformed.before.flatMap((contour, contourIndex) => {
          return contour.map((_point, pointIndex) => {
            const shift = shiftAt(deformed, contourIndex, pointIndex);

            return Math.hypot(shift.x, shift.y);
          });
        });

        return Math.max(0, ...points);
      }).sort((first, second) => {
        return first - second;
      });
      const amplitude = DEFAULT_DEFORM_AMPLITUDE * 1000;

      /**
       * Узкая буква гасится с обеих сторон сразу, поэтому по отдельной букве
       * судить нельзя: смотрим на медиану по алфавиту и на то, что не
       * замерла ни одна буква.
       */
      return {
        family,
        isEveryLetterMoving: (shifts[0] || 0) > 0,
        isMedianVisible: (shifts[Math.floor(shifts.length / 2)] || 0) >= 0.25 * amplitude,
      };
    });

    expect(report).toEqual(
      CONNECTED_FAMILIES.map((family) => {
        return { family, isEveryLetterMoving: true, isMedianVisible: true };
      })
    );
  });
});

describe('classifyContours', () => {
  it('признаёт знаком только контур, не касающийся чернил тела', () => {
    const touching = CONNECTED_FAMILIES.concat(['Anselmo', 'Benvolio', 'Pag']).flatMap(
      (family) => {
        return ALPHABET.concat(['!', ':', ';', '=', '?']).flatMap((char) => {
          const glyph = loadSource(family).getGlyph(char);

          if (!glyph) {
            return [];
          }

          const contours = splitContours(glyph.commands);
          const { markIndexes, bodyIndexes } = classifyContours(contours);
          const body = bodyIndexes.flatMap((index) => {
            return contours[index] || [];
          });

          return markIndexes.reduce<string[]>((acc, index) => {
            const area = inkContactArea(
              [{ commands: contours[index] || [], offsetX: 0 }],
              [{ commands: body, offsetX: 0 }],
              1000,
              240,
              0
            );

            if (area > 0) {
              acc.push(`${family} «${char}» контур ${index}: смыкание ${area}`);
            }

            return acc;
          }, []);
        });
      }
    );

    expect(touching).toEqual([]);
  });

  it('видит надстрочный знак у «й» и «ё» во всех шрифтах пака', () => {
    const missing = ['й', 'ё'].flatMap((char) => {
      return [
        'Abram',
        'Anselmo',
        'Benvolio',
        'Capuletty',
        'Djiovanni',
        'Eskal',
        'Gregory',
        'Lexa',
        'Lorenco',
        'Montekky',
        'Pacifico',
        'Pag',
        'Paris',
        'Salavat',
        'Samson',
      ].reduce<string[]>((acc, family) => {
        const glyph = loadSource(family).getGlyph(char);

        if (!glyph) {
          return acc;
        }

        const { markIndexes } = classifyContours(splitContours(glyph.commands));

        if (markIndexes.length === 0) {
          acc.push(`${family} «${char}»`);
        }

        return acc;
      }, []);
    });

    expect(missing).toEqual([]);
  });

  it('не выдумывает знаков у букв без диакритики', () => {
    const invented = CONNECTED_FAMILIES.flatMap((family) => {
      return ['о', 'а', 'п', 'м', 'ы', 'ъ'].reduce<string[]>((acc, char) => {
        const { markIndexes } = classifyContours(
          splitContours(takeGlyph(family, char).commands)
        );

        if (markIndexes.length > 0) {
          acc.push(`${family} «${char}»: ${markIndexes.length}`);
        }

        return acc;
      }, []);
    });

    expect(invented).toEqual([]);
  });
});

describe('перенос знаков', () => {
  const CASES = [
    { family: 'Salavat', char: 'ё' },
    { family: 'Benvolio', char: 'ё' },
    { family: 'Paris', char: 'ё' },
    { family: 'Eskal', char: 'ё' },
    { family: 'Anselmo', char: 'й' },
    { family: 'Salavat', char: '!' },
    { family: 'Anselmo', char: '!' },
    { family: 'Pag', char: 'ш' },
  ];

  it('едет одним вектором на всю группу знаков', () => {
    for (const { family, char } of CASES) {
      const deformed = deformGlyph(family, char, 21);
      const { markIndexes } = deformed.classification;

      expect(markIndexes.length).toBeGreaterThan(0);

      const shifts = addressPoints(deformed.before, markIndexes).map((entry) => {
        return shiftAt(deformed, entry.contourIndex, entry.pointIndex);
      });
      const [first] = shifts;
      const spread = shifts.reduce((acc, shift) => {
        return Math.max(
          acc,
          Math.hypot(shift.x - (first?.x || 0), shift.y - (first?.y || 0))
        );
      }, 0);

      expect({ family, char, isRigid: spread < SHIFT_EPSILON }).toEqual({
        family,
        char,
        isRigid: true,
      });
    }
  });

  it('совпадает со смещением тела под знаком', () => {
    for (const { family, char } of CASES) {
      const deformed = deformGlyph(family, char, 21);
      const { markIndexes, bodyIndexes, bodyBox } = deformed.classification;
      const markPoints = addressPoints(deformed.before, markIndexes);
      const bodyPoints = addressPoints(deformed.before, bodyIndexes);
      const [firstMark] = markPoints;

      if (!firstMark) {
        throw new Error(`У ${family} «${char}» нет точек знака`);
      }

      const markShift = shiftAt(deformed, firstMark.contourIndex, firstMark.pointIndex);

      /**
       * Смещение знака обязано быть смещением конкретной точки тела, а не
       * своим собственным: иначе знак отрывается от буквы.
       */
      const anchors = bodyPoints.filter((entry) => {
        const shift = shiftAt(deformed, entry.contourIndex, entry.pointIndex);

        return Math.hypot(shift.x - markShift.x, shift.y - markShift.y) < SHIFT_EPSILON;
      });

      expect({ family, char, hasAnchor: anchors.length > 0 }).toEqual({
        family,
        char,
        hasAnchor: true,
      });

      const markMiddleY =
        markPoints.reduce((acc, entry) => {
          return acc + entry.point.y;
        }, 0) / markPoints.length;
      const isAbove =
        Math.abs(bodyBox.maxY - markMiddleY) <= Math.abs(markMiddleY - bodyBox.minY);
      const bodyMiddleY = (bodyBox.minY + bodyBox.maxY) / 2;
      const isOnNearEdge = anchors.some((entry) => {
        return isAbove ? entry.point.y > bodyMiddleY : entry.point.y < bodyMiddleY;
      });

      expect({ family, char, isOnNearEdge }).toEqual({
        family,
        char,
        isOnNearEdge: true,
      });
    }
  });
});

describe('связность почерка', () => {
  it('не рвёт ни одного надёжного стыка', () => {
    const { broken, total } = countBrokenJoins(ROBUST_JOIN_AREA);

    expect(total).toBeGreaterThan(500);
    expect(broken).toEqual([]);
  });

  it('на волосяных касаниях держит стык заметно лучше, чем без фиксации', () => {
    const withSeam = countBrokenJoins(1);

    expect(withSeam.broken.length / withSeam.total).toBeLessThan(0.02);
  });
});

describe('краевые случаи', () => {
  it('на глифе без контуров отдаёт пустой путь', () => {
    const space = loadSource('Salavat').getGlyph(' ');

    if (!space) {
      throw new Error('В шрифте Salavat нет пробела');
    }

    expect(space.commands).toEqual([]);
    expect(
      deformGlyphPath(space.commands, {
        unitsPerEm: 1000,
        advanceWidth: space.advanceWidth,
        seed: 1,
      })
    ).toEqual([]);
  });

  it('на отсутствующем в шрифте символе отдаёт null вместо заглушки', () => {
    expect(loadSource('Stefano').getGlyph('ё')).toBeNull();
    expect(loadSource('Stefano').getKerning('ё', 'о')).toBe(0);
  });
});
