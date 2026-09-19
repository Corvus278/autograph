import {
  BOTTOM_MARGIN_RANGE,
  FREQUENCY_RANGE,
  GEOMETRY_CORRECTION_RANGES,
  HANDWRITING_FONTS,
  type ParameterRange,
  REALISM_LEVELS,
  SCENE_DARKEN_RANGE,
  SCENE_ROTATE_RANGE,
  SCENE_SCALE_RANGE,
  SCENE_SHIFT_RANGE,
  SCENES,
} from '../config';
import { INK_PALETTE } from '../lib/recipe';

import type {
  GeneratorGeometryCorrection,
  GeneratorInk,
  GeneratorRealism,
  GeneratorState,
} from './generator.types';
import { isJsonRecord } from './paperSheetJson';
import type { GeneratorSession } from './useGeneratorStore.types';

/**
 * Версия формата сохранённой сессии. Запись другой версии не читается вовсе:
 * одноимённые поля в ней могут значить другое, и по-полевая проверка их бы не
 * отличила.
 */
export const SESSION_VERSION = 1;

/**
 * Запись сессии в хранилище: сами поля и версия формата.
 */
export type SessionEnvelope = {
  /**
   * Поля сессии как есть, до проверки.
   */
  state: unknown;

  /**
   * Версия формата, которой записаны поля.
   */
  version: number;
};

/**
 * Наибольший seed прогона: seed — беззнаковое 32-битное целое.
 */
const MAX_RUN_SEED = 0xff_ff_ff_ff;

/**
 * Цвет своих чернил — только `#rrggbb`: так его отдаёт `<input type="color">`,
 * и так его понимает рецепт при разбросе оттенка.
 */
const HEX_COLOR_PATTERN = /^#[\da-f]{6}$/i;

/**
 * Строка или значение по умолчанию.
 *
 * @param value — сохранённое значение
 * @param fallback — что подставить вместо негодного
 * @returns строка
 */
const readString = (value: unknown, fallback: string): string => {
  return typeof value === 'string' ? value : fallback;
};

/**
 * Булево значение или значение по умолчанию.
 *
 * @param value — сохранённое значение
 * @param fallback — что подставить вместо негодного
 * @returns булево значение
 */
const readBoolean = (value: unknown, fallback: boolean): boolean => {
  return typeof value === 'boolean' ? value : fallback;
};

/**
 * Конечное число или значение по умолчанию.
 *
 * @param value — сохранённое значение
 * @param fallback — что подставить вместо негодного
 * @returns число
 */
const readNumber = (value: unknown, fallback: number): number => {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
};

/**
 * Число внутри диапазона контрола или значение по умолчанию. Число вне
 * диапазона не прижимается к краю, а отбрасывается: слайдер такого значения
 * выставить не мог, значит, запись испорчена.
 *
 * @param value — сохранённое значение
 * @param range — диапазон контрола
 * @param fallback — что подставить вместо негодного
 * @returns число в диапазоне
 */
const readInRange = (
  value: unknown,
  { min, max }: ParameterRange,
  fallback: number
): number => {
  const number = readNumber(value, Number.NaN);

  return number >= min && number <= max ? number : fallback;
};

/**
 * Целое число внутри диапазона или значение по умолчанию: частоты — номера
 * ступеней, дробной ступени нет.
 *
 * @param value — сохранённое значение
 * @param range — диапазон контрола
 * @param fallback — что подставить вместо негодного
 * @returns целое в диапазоне
 */
const readIntegerInRange = (
  value: unknown,
  range: ParameterRange,
  fallback: number
): number => {
  return Number.isInteger(value) ? readInRange(value, range, fallback) : fallback;
};

/**
 * Строка из списка допустимых или значение по умолчанию: сохранённый
 * идентификатор может указывать на то, чего в сборке уже нет.
 *
 * @param value — сохранённое значение
 * @param allowed — допустимые значения
 * @param fallback — что подставить вместо негодного
 * @returns допустимая строка
 */
const readOneOf = (
  value: unknown,
  allowed: readonly string[],
  fallback: string
): string => {
  return typeof value === 'string' && allowed.includes(value) ? value : fallback;
};

/**
 * Имена встроенных почерков: свой шрифт в сессию не попадает.
 */
const FONT_FAMILIES = HANDWRITING_FONTS.map(({ family }) => {
  return family;
});

/**
 * Идентификаторы оттенков палитры.
 */
const TONE_IDS = INK_PALETTE.map(({ id }) => {
  return id;
});

/**
 * Идентификаторы встроенных сцен.
 */
const SCENE_IDS = SCENES.map(({ id }) => {
  return id;
});

/**
 * Выбор чернил. Вариант проверяется целиком: оттенок, которого нет в
 * палитре, или цвет не в `#rrggbb` — это чернила по умолчанию, а не
 * полупустой вариант. Так же читается и `auto` из сессий, где выбор цвета
 * отдавался рецепту: терять из-за него всю сессию незачем.
 *
 * @param value — сохранённое значение
 * @param fallback — чернила по умолчанию
 * @returns годный выбор чернил
 */
const readInk = (value: unknown, fallback: GeneratorInk): GeneratorInk => {
  if (!isJsonRecord(value)) {
    return fallback;
  }

  switch (value.kind) {
    case 'tone': {
      return typeof value.toneId === 'string' && TONE_IDS.includes(value.toneId)
        ? { kind: 'tone', toneId: value.toneId }
        : fallback;
    }

    case 'custom': {
      return typeof value.color === 'string' && HEX_COLOR_PATTERN.test(value.color)
        ? { kind: 'custom', color: value.color }
        : fallback;
    }

    default: {
      return fallback;
    }
  }
};

/**
 * Флаги искажений по одному: негодный флаг берёт значение по умолчанию, а не
 * сбрасывает остальные.
 *
 * @param value — сохранённое значение
 * @param fallback — флаги по умолчанию
 * @returns флаги искажений
 */
const readFlags = (
  value: unknown,
  fallback: GeneratorRealism['flags']
): GeneratorRealism['flags'] => {
  const record = isJsonRecord(value) ? value : {};

  return {
    isWordRotated: readBoolean(record.isWordRotated, fallback.isWordRotated),
    isWordSkewed: readBoolean(record.isWordSkewed, fallback.isWordSkewed),
    isWordShifted: readBoolean(record.isWordShifted, fallback.isWordShifted),
    isLetterSpacingRandom: readBoolean(
      record.isLetterSpacingRandom,
      fallback.isLetterSpacingRandom
    ),
    isLetterFontRandom: readBoolean(
      record.isLetterFontRandom,
      fallback.isLetterFontRandom
    ),
    isLineRotated: readBoolean(record.isLineRotated, fallback.isLineRotated),
    isLineShifted: readBoolean(record.isLineShifted, fallback.isLineShifted),
  };
};

/**
 * Реализм почерка. Ступень — главное поле: названная ступень берёт значения
 * из таблицы ступеней, а не из записи, поэтому правка таблицы доходит и до
 * сохранённых сессий. Неизвестная ступень делает негодным весь реализм: к
 * чему относятся сохранённые рядом значения, уже не понять. Проверяются по
 * одному только поля своей ступени (`custom`).
 *
 * @param value — сохранённое значение
 * @param fallback — реализм по умолчанию
 * @returns годный реализм
 */
const readRealism = (value: unknown, fallback: GeneratorRealism): GeneratorRealism => {
  if (!isJsonRecord(value)) {
    return fallback;
  }

  if (value.level === 'custom') {
    return {
      level: 'custom',
      flags: readFlags(value.flags, fallback.flags),
      wordFrequency: readIntegerInRange(
        value.wordFrequency,
        FREQUENCY_RANGE,
        fallback.wordFrequency
      ),
      letterFrequency: readIntegerInRange(
        value.letterFrequency,
        FREQUENCY_RANGE,
        fallback.letterFrequency
      ),
      hasContourVariance: readBoolean(
        value.hasContourVariance,
        fallback.hasContourVariance
      ),
    };
  }

  const level = REALISM_LEVELS.find(({ id }) => {
    return id === value.level;
  });

  if (!level) {
    return fallback;
  }

  const { id, flags, wordFrequency, letterFrequency, hasContourVariance } = level;

  return {
    level: id,
    flags: { ...flags },
    wordFrequency,
    letterFrequency,
    hasContourVariance,
  };
};

/**
 * Поправка геометрии по составляющим: негодная составляющая — вне диапазона
 * своего слайдера или не число — берёт значение по умолчанию, остальные
 * восстанавливаются.
 *
 * @param value — сохранённое значение
 * @param fallback — поправка по умолчанию
 * @returns поправка геометрии
 */
const readGeometryCorrection = (
  value: unknown,
  fallback: GeneratorGeometryCorrection
): GeneratorGeometryCorrection => {
  const record = isJsonRecord(value) ? value : {};

  return {
    fontSizePx: readInRange(
      record.fontSizePx,
      GEOMETRY_CORRECTION_RANGES.fontSizePx,
      fallback.fontSizePx
    ),
    lineSpacing: readInRange(
      record.lineSpacing,
      GEOMETRY_CORRECTION_RANGES.lineSpacing,
      fallback.lineSpacing
    ),
    topOffset: readInRange(
      record.topOffset,
      GEOMETRY_CORRECTION_RANGES.topOffset,
      fallback.topOffset
    ),
    leftPadding: readInRange(
      record.leftPadding,
      GEOMETRY_CORRECTION_RANGES.leftPadding,
      fallback.leftPadding
    ),
    blockWidth: readInRange(
      record.blockWidth,
      GEOMETRY_CORRECTION_RANGES.blockWidth,
      fallback.blockWidth
    ),
  };
};

/**
 * Seed прогона — беззнаковое 32-битное целое, как его ведёт `startNewRun`.
 *
 * @param value — сохранённое значение
 * @param fallback — seed по умолчанию
 * @returns seed прогона
 */
const readRunSeed = (value: unknown, fallback: number): number => {
  return Number.isInteger(value)
    ? readInRange(value, { min: 0, max: MAX_RUN_SEED, step: 1 }, fallback)
    : fallback;
};

/**
 * Сессия из состояния стора: документ и режим разворота, без ресурсов и
 * остального просмотра.
 *
 * @param state — состояние генератора
 * @returns поля сессии
 */
export const toSession = (state: GeneratorState): GeneratorSession => {
  return {
    text: state.text,
    fontFamily: state.fontFamily,
    ink: state.ink,
    familyId: state.familyId,
    sheetId: state.sheetId,
    isSheetPinned: state.isSheetPinned,
    realism: state.realism,
    geometryCorrection: state.geometryCorrection,
    bottomMargin: state.bottomMargin,
    isSceneEnabled: state.isSceneEnabled,
    sceneId: state.sceneId,
    sceneRotate: state.sceneRotate,
    sceneShiftX: state.sceneShiftX,
    sceneShiftY: state.sceneShiftY,
    sceneScale: state.sceneScale,
    sceneDarken: state.sceneDarken,
    hasSceneShadow: state.hasSceneShadow,
    runSeed: state.runSeed,
    isSpread: state.isSpread,
  };
};

/**
 * Проверяет сохранённую сессию по полям: негодное поле получает значение по
 * умолчанию, годные восстанавливаются. Ссылки на листы (`familyId`,
 * `sheetId`) проверяются только на тип — свои листы в этот момент ещё не
 * прочитаны, и существует ли лист, решает шаг после их чтения.
 *
 * @param value — сохранённые поля в том виде, в каком их отдал `JSON.parse`
 * @param defaults — значения по умолчанию
 * @returns годная сессия
 */
export const parseSession = (
  value: unknown,
  defaults: GeneratorSession
): GeneratorSession => {
  if (!isJsonRecord(value)) {
    return defaults;
  }

  return {
    text: readString(value.text, defaults.text),
    fontFamily: readOneOf(value.fontFamily, FONT_FAMILIES, defaults.fontFamily),
    ink: readInk(value.ink, defaults.ink),
    familyId: readString(value.familyId, defaults.familyId),
    sheetId: readString(value.sheetId, defaults.sheetId),
    isSheetPinned: readBoolean(value.isSheetPinned, defaults.isSheetPinned),
    realism: readRealism(value.realism, defaults.realism),
    geometryCorrection: readGeometryCorrection(
      value.geometryCorrection,
      defaults.geometryCorrection
    ),
    bottomMargin: readInRange(
      value.bottomMargin,
      BOTTOM_MARGIN_RANGE,
      defaults.bottomMargin
    ),
    isSceneEnabled: readBoolean(value.isSceneEnabled, defaults.isSceneEnabled),
    sceneId: readOneOf(value.sceneId, SCENE_IDS, defaults.sceneId),
    sceneRotate: readInRange(value.sceneRotate, SCENE_ROTATE_RANGE, defaults.sceneRotate),
    sceneShiftX: readInRange(value.sceneShiftX, SCENE_SHIFT_RANGE, defaults.sceneShiftX),
    sceneShiftY: readInRange(value.sceneShiftY, SCENE_SHIFT_RANGE, defaults.sceneShiftY),
    sceneScale: readInRange(value.sceneScale, SCENE_SCALE_RANGE, defaults.sceneScale),
    sceneDarken: readInRange(value.sceneDarken, SCENE_DARKEN_RANGE, defaults.sceneDarken),
    hasSceneShadow: readBoolean(value.hasSceneShadow, defaults.hasSceneShadow),
    runSeed: readRunSeed(value.runSeed, defaults.runSeed),
    isSpread: readBoolean(value.isSpread, defaults.isSpread),
  };
};

/**
 * Разбирает запись сессии из хранилища. `null` — читать нечего: записи нет,
 * она не JSON, не той формы или записана другой версией формата. Генератор
 * тогда открывается с настройками по умолчанию.
 *
 * @param raw — строка из хранилища; `null` — ключа нет
 * @returns запись текущей версии или `null`
 */
export const parseSessionEnvelope = (raw: string | null): SessionEnvelope | null => {
  if (!raw) {
    return null;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!isJsonRecord(parsed) || parsed.version !== SESSION_VERSION) {
    return null;
  }

  return { state: parsed.state, version: SESSION_VERSION };
};
