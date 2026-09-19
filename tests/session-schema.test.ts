import {
  GEOMETRY_CORRECTION_RANGES,
  HANDWRITING_FONTS,
  REALISM_LEVELS,
} from '@pages/Generator/config';
import {
  parseSession,
  parseSessionEnvelope,
  SESSION_VERSION,
  toSession,
} from '@pages/Generator/model/sessionSchema';
import { DEFAULT_GENERATOR_STATE } from '@pages/Generator/model/useGeneratorStore';
import type { GeneratorSession } from '@pages/Generator/model/useGeneratorStore.types';
import { describe, expect, it } from 'vitest';

/**
 * Значения по умолчанию, в которые откатывается негодное поле.
 */
const DEFAULTS = toSession(DEFAULT_GENERATOR_STATE);

/**
 * Ступень «Небрежно» — заведомо не та, что по умолчанию.
 */
const SLOPPY = REALISM_LEVELS.find(({ id }) => {
  return id === 'sloppy';
});

/**
 * Годная сессия, в которой каждое поле отличается от значения по умолчанию:
 * так видно, что восстановлено именно сохранённое, а не дефолт.
 */
const VALID: GeneratorSession = {
  text: 'Привет',
  fontFamily: HANDWRITING_FONTS[2]?.family || '',
  ink: { kind: 'tone', toneId: 'gel-blue' },
  familyId: 'lined',
  sheetId: 'lined-2',
  isSheetPinned: true,
  realism: {
    level: 'custom',
    flags: {
      ...DEFAULTS.realism.flags,
      isWordRotated: !DEFAULTS.realism.flags.isWordRotated,
    },
    wordFrequency: 5,
    letterFrequency: 5,
    hasContourVariance: !DEFAULTS.realism.hasContourVariance,
  },
  geometryCorrection: {
    fontSizePx: 0.1,
    lineSpacing: -0.2,
    topOffset: 0.5,
    leftPadding: -0.5,
    blockWidth: 1,
  },
  bottomMargin: 3,
  isSceneEnabled: true,
  sceneId: 'notebook',
  sceneRotate: -4,
  sceneShiftX: 10,
  sceneShiftY: 20,
  sceneScale: -50,
  sceneDarken: 0.03,
  hasSceneShadow: true,
  runSeed: 42,
  isSpread: true,
};

/**
 * Сессия, в которой испорчено одно поле.
 *
 * @param patch — испорченное поле
 * @returns запись сессии в виде, в котором её отдаёт `JSON.parse`
 */
const withField = (patch: Record<string, unknown>): Record<string, unknown> => {
  return { ...VALID, ...patch };
};

describe('parseSession', () => {
  it('восстанавливает годную сессию целиком', () => {
    expect(parseSession(VALID, DEFAULTS)).toEqual(VALID);
  });

  it('не отдаёт наружу лишние поля записи', () => {
    const session = parseSession(
      { ...VALID, customFontFamily: 'UserFont', zoom: 2 },
      DEFAULTS
    );

    expect(session).not.toHaveProperty('customFontFamily');
    expect(session).not.toHaveProperty('zoom');
  });

  it.each([
    ['text', 42],
    ['fontFamily', 7],
    ['ink', 'auto'],
    ['familyId', null],
    ['sheetId', 1],
    ['isSheetPinned', 'yes'],
    ['realism', []],
    ['geometryCorrection', 'none'],
    ['bottomMargin', '3'],
    ['isSceneEnabled', 1],
    ['sceneId', false],
    ['sceneRotate', Number.NaN],
    ['sceneShiftX', '10'],
    ['sceneShiftY', null],
    ['sceneScale', {}],
    ['sceneDarken', true],
    ['hasSceneShadow', 'true'],
    ['runSeed', '42'],
    ['isSpread', 0],
  ] as const)(
    'поле %s неверного типа — дефолт, остальные восстановлены',
    (field, value) => {
      const session = parseSession(withField({ [field]: value }), DEFAULTS);

      expect(session).toEqual({ ...VALID, [field]: DEFAULTS[field] });
    }
  );

  it.each([
    ['bottomMargin', 99],
    ['bottomMargin', -1],
    ['sceneRotate', 50],
    ['sceneShiftX', -1],
    ['sceneShiftY', 51],
    ['sceneScale', 1000],
    ['sceneDarken', 0.5],
    ['runSeed', -1],
    ['runSeed', 2 ** 32],
    ['runSeed', 1.5],
  ] as const)('поле %s вне диапазона (%s) — дефолт', (field, value) => {
    const session = parseSession(withField({ [field]: value }), DEFAULTS);

    expect(session).toEqual({ ...VALID, [field]: DEFAULTS[field] });
  });

  it('встроенного почерка с таким именем нет — первый встроенный', () => {
    const session = parseSession(withField({ fontFamily: 'UserFont' }), DEFAULTS);

    expect(session.fontFamily).toBe(DEFAULTS.fontFamily);
  });

  it('сцены с таким идентификатором нет — сцена по умолчанию', () => {
    const session = parseSession(withField({ sceneId: 'moon' }), DEFAULTS);

    expect(session.sceneId).toBe(DEFAULTS.sceneId);
  });

  describe('чернила', () => {
    it.each([
      [{ kind: 'tone', toneId: 'ballpoint-black' }],
      [{ kind: 'custom', color: '#12ab9F' }],
    ])('годный вариант %j восстанавливается', (ink) => {
      expect(parseSession(withField({ ink }), DEFAULTS).ink).toEqual(ink);
    });

    it.each([
      [{ kind: 'auto' }],
      [{ kind: 'tone', toneId: 'neon-green' }],
      [{ kind: 'tone' }],
      [{ kind: 'custom', color: 'red' }],
      [{ kind: 'custom', color: '#12ab9' }],
      [{ kind: 'marker' }],
      [null],
    ])('негодный вариант %j — чернила по умолчанию', (ink) => {
      const session = parseSession(withField({ ink }), DEFAULTS);

      expect(session).toEqual({ ...VALID, ink: DEFAULTS.ink });
    });
  });

  describe('реализм', () => {
    it('неизвестная ступень — реализм по умолчанию целиком', () => {
      const session = parseSession(
        withField({ realism: { ...VALID.realism, level: 'chaotic' } }),
        DEFAULTS
      );

      expect(session).toEqual({ ...VALID, realism: DEFAULTS.realism });
    });

    it('названная ступень берёт значения из таблицы ступеней', () => {
      const session = parseSession(
        withField({ realism: { ...VALID.realism, level: 'sloppy', wordFrequency: 'x' } }),
        DEFAULTS
      );

      expect(session.realism).toEqual({
        level: 'sloppy',
        flags: SLOPPY?.flags,
        wordFrequency: SLOPPY?.wordFrequency,
        letterFrequency: SLOPPY?.letterFrequency,
        hasContourVariance: SLOPPY?.hasContourVariance,
      });
    });

    it.each([
      ['wordFrequency', 0],
      ['wordFrequency', 2.5],
      ['letterFrequency', 6],
      ['letterFrequency', 'often'],
      ['hasContourVariance', 1],
    ] as const)('своя ступень: негодное %s (%s) — дефолт этого поля', (field, value) => {
      const session = parseSession(
        withField({ realism: { ...VALID.realism, [field]: value } }),
        DEFAULTS
      );

      expect(session.realism).toEqual({
        ...VALID.realism,
        [field]: DEFAULTS.realism[field],
      });
    });

    it('своя ступень: негодный флаг искажения — дефолт только этого флага', () => {
      const flags = { ...VALID.realism.flags, isLineShifted: 'no' };
      const session = parseSession(
        withField({ realism: { ...VALID.realism, flags } }),
        DEFAULTS
      );

      expect(session.realism.flags).toEqual({
        ...VALID.realism.flags,
        isLineShifted: DEFAULTS.realism.flags.isLineShifted,
      });
    });
  });

  it('негодная составляющая поправки геометрии — ноль только у неё', () => {
    const geometryCorrection = { ...VALID.geometryCorrection, topOffset: 'up' };
    const session = parseSession(withField({ geometryCorrection }), DEFAULTS);

    expect(session.geometryCorrection).toEqual({
      ...VALID.geometryCorrection,
      topOffset: DEFAULTS.geometryCorrection.topOffset,
    });
  });

  it.each([
    ['fontSizePx', 0.3],
    ['fontSizePx', -0.26],
    ['lineSpacing', 0.5],
    ['topOffset', 2.5],
    ['leftPadding', -3],
    ['blockWidth', 4.5],
  ] as const)(
    'составляющая поправки %s = %d вне диапазона слайдера — ноль только у неё',
    (field, value) => {
      const geometryCorrection = { ...VALID.geometryCorrection, [field]: value };
      const session = parseSession(withField({ geometryCorrection }), DEFAULTS);

      expect(session.geometryCorrection).toEqual({
        ...VALID.geometryCorrection,
        [field]: DEFAULTS.geometryCorrection[field],
      });
    }
  );

  it('составляющая поправки на краю диапазона слайдера сохраняется', () => {
    const geometryCorrection = {
      fontSizePx: GEOMETRY_CORRECTION_RANGES.fontSizePx.max,
      lineSpacing: GEOMETRY_CORRECTION_RANGES.lineSpacing.min,
      topOffset: GEOMETRY_CORRECTION_RANGES.topOffset.max,
      leftPadding: GEOMETRY_CORRECTION_RANGES.leftPadding.min,
      blockWidth: GEOMETRY_CORRECTION_RANGES.blockWidth.max,
    };
    const session = parseSession(withField({ geometryCorrection }), DEFAULTS);

    expect(session.geometryCorrection).toEqual(geometryCorrection);
  });

  it.each([[null], [undefined], ['текст'], [42], [[VALID]]])(
    'запись %j не объект — сессия по умолчанию',
    (value) => {
      expect(parseSession(value, DEFAULTS)).toEqual(DEFAULTS);
    }
  );
});

describe('parseSessionEnvelope', () => {
  it('годная запись текущей версии разбирается', () => {
    const raw = JSON.stringify({ state: VALID, version: SESSION_VERSION });

    expect(parseSessionEnvelope(raw)).toEqual({ state: VALID, version: SESSION_VERSION });
  });

  it.each([
    ['не JSON', '{state: оборвано'],
    ['пустая строка', ''],
    ['JSON не объект', '"сессия"'],
    ['нет версии', JSON.stringify({ state: VALID })],
    ['чужая версия', JSON.stringify({ state: VALID, version: SESSION_VERSION + 1 })],
    [
      'версия строкой',
      JSON.stringify({ state: VALID, version: String(SESSION_VERSION) }),
    ],
  ])('%s — записи нет', (_, raw) => {
    expect(parseSessionEnvelope(raw)).toBeNull();
  });

  it('ключа нет — записи нет', () => {
    expect(parseSessionEnvelope(null)).toBeNull();
  });
});
