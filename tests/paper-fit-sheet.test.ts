import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { buildPaperFamilies } from '@pages/Generator/config/paperFamilies';
import type { PaperFamily, PaperSheet } from '@pages/Generator/lib/paper';
import { computeNormalizeScale, fitSheetToPage } from '@pages/Generator/lib/paper';
import { parsePaperProfiles } from '@pages/Generator/model/paperProfiles';
import { describe, expect, it } from 'vitest';

/**
 * Канон семьи-модели: шаг и отступ первой линии круглые, чтобы попадание
 * считалось в уме.
 */
const CANONICAL_STEP = 80;
const FIRST_LINE_OFFSET = 160;
const PAGE_WIDTH = 1650;
const PAGE_HEIGHT = 2000;

/**
 * Шаг, измеренный на фотографии: заметно мельче канонического, поэтому
 * нормировка — не единица, и подмена её на растяжение по странице сразу видна.
 */
const MEASURED_STEP = 64;
const FIRST_LINE_PHASE = 100;

/**
 * Допустимое отклонение базовой линии от линии разлиновки в долях шага — то
 * же, что в требовании «Строки ложатся на линии».
 */
const DRIFT_TOLERANCE = 0.1;

const FAMILY: PaperFamily = {
  id: 'lined',
  label: 'В линейку',
  width: PAGE_WIDTH,
  height: PAGE_HEIGHT,
  ruling: {
    kind: 'lined',
    step: CANONICAL_STEP,
    firstLineOffset: FIRST_LINE_OFFSET,
    margins: { top: 160, right: 80, bottom: 120, left: 100 },
    marginLineX: 250,
  },
  sheets: [],
};

const buildSheet = (patch: Partial<PaperSheet> = {}): PaperSheet => {
  return {
    id: 'sheet-1',
    label: 'Лист 1',
    src: '/paper/lined/1.jpg',
    width: 1500,
    height: 1900,
    skewAngle: 0,
    measuredStep: MEASURED_STEP,
    normalizeScale: computeNormalizeScale(MEASURED_STEP, CANONICAL_STEP),
    firstLinePhase: FIRST_LINE_PHASE,
    lighting: null,
    texture: null,
    ...patch,
  };
};

/**
 * Где на странице оказалась линия разлиновки фотографии — у её левого края,
 * там же, где рендерер отсчитывает базовые линии.
 *
 * Считается по отрисованному прямоугольнику, а не по нормировке: проверять
 * нужно именно то, чем рендерер рисует фон, — растянись фотография по
 * странице, её линии разъехались бы, а сама нормировка осталась бы прежней.
 *
 * @param sheet — экземпляр листа
 * @param family — семья, на страницу которой лёг лист
 * @param lineIndex — номер линии фотографии, считая с нуля
 * @param isMirrored — страница отражена
 * @returns координата линии в канонических пикселях страницы
 */
const measurePhotoLine = (
  sheet: PaperSheet,
  family: PaperFamily,
  lineIndex: number,
  isMirrored = false
): number => {
  const placement = fitSheetToPage(sheet, family, isMirrored);
  const scale = placement.height / sheet.height;
  const tilt = Math.tan((sheet.skewAngle * Math.PI) / 180);

  /**
   * Отражение переворачивает наклон разлиновки, поэтому у левого края страницы
   * оказывается линия, опущенная на наклон во всю её ширину.
   */
  return (
    placement.y +
    (sheet.firstLinePhase + lineIndex * sheet.measuredStep) * scale +
    (isMirrored ? tilt * family.width : 0)
  );
};

/**
 * Наибольшее отклонение линий фотографии от канонических линий в долях шага.
 *
 * @param sheet — экземпляр листа
 * @param family — семья, на страницу которой лёг лист
 * @param isMirrored — страница отражена
 * @returns отклонение в долях канонического шага
 */
const measureRulingDrift = (
  sheet: PaperSheet,
  family: PaperFamily,
  isMirrored = false
): number => {
  const { step, firstLineOffset } = family.ruling;
  const lineCount = Math.floor(sheet.height / sheet.measuredStep);
  let drift = 0;

  for (let index = 0; index < lineCount; index += 1) {
    const lineY = measurePhotoLine(sheet, family, index, isMirrored);
    const lines = (lineY - firstLineOffset) / step;

    drift = Math.max(drift, Math.abs(lines - Math.round(lines)));
  }

  return drift;
};

describe('укладка фотографии листа на страницу', () => {
  it('приводит шаг фотографии к каноническому шагу семьи', () => {
    const sheet = buildSheet();
    const placement = fitSheetToPage(sheet, FAMILY, false);
    const scale = placement.height / sheet.height;

    expect(sheet.measuredStep * sheet.normalizeScale).toBeCloseTo(CANONICAL_STEP, 9);
    expect(sheet.measuredStep * scale).toBeCloseTo(CANONICAL_STEP, 9);
  });

  it('не растягивает фотографию по размеру страницы', () => {
    const sheet = buildSheet();
    const placement = fitSheetToPage(sheet, FAMILY, false);

    expect(placement.width).toBeCloseTo(sheet.width * sheet.normalizeScale, 9);
    expect(placement.height).toBeCloseTo(sheet.height * sheet.normalizeScale, 9);
    expect(placement.width).not.toBeCloseTo(PAGE_WIDTH);
    expect(placement.height).not.toBeCloseTo(PAGE_HEIGHT);
  });

  it('садит первую линию фотографии на первую линию канона', () => {
    const sheet = buildSheet();
    const lineY = measurePhotoLine(sheet, FAMILY, 0);
    const lines = (lineY - FIRST_LINE_OFFSET) / CANONICAL_STEP;

    expect(lines).toBeCloseTo(Math.round(lines), 9);
    expect(measureRulingDrift(sheet, FAMILY)).toBeLessThanOrEqual(DRIFT_TOLERANCE);
  });

  it('сдвигает лист кратно шагу, пока он закрывает страницу целиком', () => {
    /**
     * Фотография заметно выше страницы, а её первая линия по фазе оказалась бы
     * ниже канонической: без сдвига кратно шагу у верха страницы осталась бы
     * непокрытая полоса.
     */
    const sheet = buildSheet({ height: 3000, firstLinePhase: 0 });
    const placement = fitSheetToPage(sheet, FAMILY, false);
    const rawOffset = FIRST_LINE_OFFSET;
    const shift = (rawOffset - placement.y) / CANONICAL_STEP;

    expect(placement.y).toBeLessThanOrEqual(0);
    expect(placement.y + placement.height).toBeGreaterThanOrEqual(PAGE_HEIGHT);
    expect(shift).toBeCloseTo(Math.round(shift), 9);
    expect(measureRulingDrift(sheet, FAMILY)).toBeLessThanOrEqual(DRIFT_TOLERANCE);
  });

  it('выбирает сдвиг однозначно, когда страницу закрывает не один из них', () => {
    /**
     * Лист вдвое выше страницы: страницу закрывает целиком не один сдвиг
     * кратно шагу. Из равных берётся верхний — тот, при котором верх страницы
     * закрыт с запасом, а лишнее уходит под нижний край. Сравнение покрытий
     * идёт с порогом: без него равные варианты выбирались бы разрядным шумом,
     * и лист прыгал бы на целый шаг от пересчёта к пересчёту.
     */
    const sheet = buildSheet({ height: 3000, firstLinePhase: 8 });
    const placement = fitSheetToPage(sheet, FAMILY, false);
    const rawOffset = FIRST_LINE_OFFSET - 8 * sheet.normalizeScale;

    expect(placement.y).toBeCloseTo(rawOffset - CANONICAL_STEP * 2, 9);
    expect(placement.y).toBeLessThanOrEqual(0);
    expect(placement.y + placement.height).toBeGreaterThanOrEqual(PAGE_HEIGHT);
    expect(measureRulingDrift(sheet, FAMILY)).toBeLessThanOrEqual(DRIFT_TOLERANCE);
  });

  it('оставляет полосу подложки, когда листа не хватает, но линии не сдвигает', () => {
    /**
     * Такой фотографии не хватает на страницу ни при каком сдвиге: она короче
     * страницы. Растянуть её значило бы вернуть тот же дефект, поэтому лист
     * ложится как есть, а под непокрытой полосой остаётся подложка.
     */
    const sheet = buildSheet({ height: 1200 });
    const placement = fitSheetToPage(sheet, FAMILY, false);

    expect(placement.height).toBeLessThan(PAGE_HEIGHT);
    expect(placement.y).toBeGreaterThanOrEqual(0);
    expect(placement.y + placement.height).toBeLessThanOrEqual(PAGE_HEIGHT);
    expect(measureRulingDrift(sheet, FAMILY)).toBeLessThanOrEqual(DRIFT_TOLERANCE);
  });

  it('прижимает отражённый лист к правому краю', () => {
    const sheet = buildSheet();
    const straight = fitSheetToPage(sheet, FAMILY, false);
    const mirrored = fitSheetToPage(sheet, FAMILY, true);

    /**
     * У ровного листа отражение не двигает разлиновку по вертикали: наклона
     * нет, и переворачивать нечего. По горизонтали лист уходит к правому краю —
     * там после отражения оказывается линия поля.
     */
    expect(mirrored.y).toBeCloseTo(straight.y, 9);
    expect(mirrored.height).toBeCloseTo(straight.height, 9);
    expect(mirrored.x + mirrored.width).toBeCloseTo(PAGE_WIDTH, 9);
    expect(measureRulingDrift(sheet, FAMILY, true)).toBeLessThanOrEqual(DRIFT_TOLERANCE);
  });

  it('доворачивает фазу отражённого листа на его наклон', () => {
    /**
     * Наклон такой, что за ширину страницы линия опускается ровно на половину
     * шага: не учти отражение наклон — и строки сели бы точно между линий.
     */
    const skewAngle = (Math.atan(CANONICAL_STEP / 2 / PAGE_WIDTH) * 180) / Math.PI;
    const sheet = buildSheet({ skewAngle });
    const straight = fitSheetToPage(sheet, FAMILY, false);
    const mirrored = fitSheetToPage(sheet, FAMILY, true);
    const shift = (straight.y - mirrored.y) / CANONICAL_STEP;

    expect(Math.abs(shift - Math.round(shift))).toBeCloseTo(0.5, 6);
    expect(measureRulingDrift(sheet, FAMILY, true)).toBeLessThanOrEqual(DRIFT_TOLERANCE);
    expect(measureRulingDrift(sheet, FAMILY, false)).toBeLessThanOrEqual(DRIFT_TOLERANCE);
  });

  it('кладёт лист без размеров во всю страницу', () => {
    const sheet = buildSheet({ width: 0, height: 0 });

    expect(fitSheetToPage(sheet, FAMILY, false)).toEqual({
      x: 0,
      y: 0,
      width: PAGE_WIDTH,
      height: PAGE_HEIGHT,
    });
  });
});

/**
 * Артефакт профилей пресет-пака: те самые числа, по которым рисуются
 * предустановленные листы. Проверка на модели могла бы разойтись с ними —
 * например, если бы у настоящих экземпляров нормировка вышла единицей.
 */
const PROFILES_PATH = fileURLToPath(
  new URL('../public/paper/profiles.json', import.meta.url)
);

const PRESET_FAMILIES = buildPaperFamilies(
  parsePaperProfiles(JSON.parse(readFileSync(PROFILES_PATH, 'utf8')) as unknown)
);

describe('укладка листов пресет-пака', () => {
  it('находит измеренные экземпляры в артефакте профилей', () => {
    const measured = PRESET_FAMILIES.flatMap(({ sheets }) => {
      return sheets.filter((sheet) => {
        return sheet.normalizeScale !== 1;
      });
    });

    expect(measured.length).toBeGreaterThan(0);
  });

  it.each(
    PRESET_FAMILIES.flatMap((family) => {
      return family.sheets.map((sheet) => {
        return { familyId: family.id, sheetId: sheet.id, family, sheet };
      });
    })
  )('кладёт $sheetId на канон семьи $familyId', ({ family, sheet }) => {
    const placement = fitSheetToPage(sheet, family, false);
    const scale = placement.height / sheet.height;

    expect(sheet.measuredStep * sheet.normalizeScale).toBeCloseTo(family.ruling.step, 6);
    expect(sheet.measuredStep * scale).toBeCloseTo(family.ruling.step, 6);
    expect(measureRulingDrift(sheet, family)).toBeLessThanOrEqual(DRIFT_TOLERANCE);
    expect(measureRulingDrift(sheet, family, true)).toBeLessThanOrEqual(DRIFT_TOLERANCE);
  });
});
