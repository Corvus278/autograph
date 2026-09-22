import { readFileSync } from 'node:fs';
import { extname } from 'node:path';

import type { Page } from 'playwright';

import type {
  MarginLineReport,
  MarginLineThreshold,
  PaperMargins,
  SheetFrame,
  SheetImageData,
  SheetOutline,
  SheetPhotoBandedReport,
  SheetPhotoMeasurement,
  SheetPoint,
  SheetRuling,
} from '../src/pages/Generator/lib/paper';
import { measureBendDeviation } from '../src/pages/Generator/lib/paper';

/**
 * Общая часть скриптов сборки профилей и замера листа: декодер фотографии через
 * Chromium и строки отчёта. Оба скрипта печатают одно и то же, чтобы замер
 * своей фотографии сверялся с пресетами без пересчёта в уме.
 */

/**
 * Полутоновая выжимка, полученная из вкладки: яркости упакованы в base64,
 * иначе перегон миллионов чисел через мост занимает больше самого анализа.
 */
type DecodedGray = {
  /**
   * Ширина фотографии в пикселях.
   */
  width: number;

  /**
   * Высота фотографии в пикселях.
   */
  height: number;

  /**
   * Яркости пикселей, по байту на пиксель, в base64.
   */
  gray: string;
};

/**
 * Вход декодера во вкладке: файл в base64 и его тип для `data:`-ссылки.
 */
type EncodedPhoto = {
  /**
   * Содержимое файла в base64.
   */
  data: string;

  /**
   * MIME-тип файла.
   */
  mimeType: string;
};

/**
 * Сторона контура листа.
 */
type OutlineSide = 'top' | 'right' | 'bottom' | 'left';

/**
 * Всё, из чего собирается отчёт по одному листу.
 */
export type SheetReportInput = {
  /**
   * Результат измерения фотографии.
   */
  measurement: SheetPhotoMeasurement;

  /**
   * Разлиновка, собранная из измерения: поля с фолбэком, перспектива, изгиб.
   */
  ruling: SheetRuling;

  /**
   * Кадр фотографии.
   */
  frame: SheetFrame;

  /**
   * Время измерения, мс.
   */
  elapsedMs: number;
};

/**
 * Стороны полей в порядке печати: сверху по часовой стрелке.
 */
const MARGIN_SIDES: (keyof PaperMargins)[] = ['top', 'right', 'bottom', 'left'];

/**
 * Стороны контура в порядке печати: сверху по часовой стрелке.
 */
const OUTLINE_SIDES: OutlineSide[] = ['top', 'right', 'bottom', 'left'];

/**
 * Подписи сторон контура.
 */
const OUTLINE_SIDE_LABELS: Record<OutlineSide, string> = {
  top: 'верх',
  right: 'право',
  bottom: 'низ',
  left: 'лево',
};

/**
 * Типы изображений по расширению: jpeg пресетов и png, которые приходят от
 * пользователя.
 */
const MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

/**
 * Снимает полутоновую выжимку с фотографии: декодировать изображение в node
 * нечем, а Chromium уже стоит для скриншотных тестов.
 *
 * @param page — открытая вкладка Chromium
 * @param path — путь к файлу фотографии
 * @returns яркости по Rec.709 от 0 до 1
 */
export const decodeSheetPhoto = async (
  page: Page,
  path: string
): Promise<SheetImageData> => {
  const input: EncodedPhoto = {
    data: readFileSync(path).toString('base64'),
    mimeType: MIME_TYPES[extname(path).toLowerCase()] || 'image/jpeg',
  };
  const decoded = await page.evaluate(async ({ data, mimeType }: EncodedPhoto) => {
    const image = new Image();

    image.src = `data:${mimeType};base64,${data}`;
    await image.decode();

    const canvas = document.createElement('canvas');

    canvas.width = image.width;
    canvas.height = image.height;

    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Канва для декодирования фотографии недоступна');
    }

    context.drawImage(image, 0, 0);

    const frame = context.getImageData(0, 0, canvas.width, canvas.height);
    const gray = new Uint8Array(canvas.width * canvas.height);

    for (let index = 0; index < gray.length; index += 1) {
      gray[index] = Math.round(
        0.2126 * (frame.data[index * 4] || 0) +
          0.7152 * (frame.data[index * 4 + 1] || 0) +
          0.0722 * (frame.data[index * 4 + 2] || 0)
      );
    }

    let binary = '';
    const chunkSize = 0x80_00;

    for (let index = 0; index < gray.length; index += chunkSize) {
      binary += String.fromCharCode(...gray.subarray(index, index + chunkSize));
    }

    const result: DecodedGray = {
      width: canvas.width,
      height: canvas.height,
      gray: btoa(binary),
    };

    return result;
  }, input);
  const bytes = Buffer.from(decoded.gray, 'base64');
  const luminance = new Float32Array(bytes.length);

  for (let index = 0; index < bytes.length; index += 1) {
    luminance[index] = (bytes[index] || 0) / 255;
  }

  return { width: decoded.width, height: decoded.height, luminance };
};

/**
 * Проверяет, найдена ли сторона контура. Ненайденная сторона лежит точно на
 * краю кадра, поэтому сравнение строгое.
 *
 * @param outline — контур листа
 * @param side — сторона
 * @param frame — кадр фотографии
 * @returns `true`, если сторона найдена на фотографии
 */
const isOutlineSideFound = (
  outline: SheetOutline,
  side: OutlineSide,
  frame: SheetFrame
): boolean => {
  const { topLeft, topRight, bottomRight, bottomLeft } = outline;

  switch (side) {
    case 'top': {
      return topLeft.y !== 0 || topRight.y !== 0;
    }

    case 'right': {
      return topRight.x !== frame.width || bottomRight.x !== frame.width;
    }

    case 'bottom': {
      return bottomLeft.y !== frame.height || bottomRight.y !== frame.height;
    }

    case 'left': {
      return topLeft.x !== 0 || bottomLeft.x !== 0;
    }

    default: {
      throw new Error(`Unknown outline side: ${String(side)}`);
    }
  }
};

const formatPoint = ({ x, y }: SheetPoint): string => {
  return `(${x.toFixed(1)}, ${y.toFixed(1)})`;
};

/**
 * Контур: какие стороны найдены на снимке и где углы. «Нет» — лист во весь
 * кадр, ни одной стороны не нашлось.
 */
const describeOutline = (outline: SheetOutline | null, frame: SheetFrame): string => {
  if (!outline) {
    return 'контур: нет';
  }

  const sides = OUTLINE_SIDES.reduce<string[]>((acc, side) => {
    if (isOutlineSideFound(outline, side, frame)) {
      acc.push(OUTLINE_SIDE_LABELS[side]);
    }

    return acc;
  }, []);
  const { topLeft, topRight, bottomRight, bottomLeft } = outline;
  const corners = [topLeft, topRight, bottomRight, bottomLeft].map(formatPoint).join(' ');

  return `контур: стороны ${sides.join('/') || 'нет'}, углы ${corners}`;
};

/**
 * Полосовая ступень замера периода: шаги согласившихся полос сверху вниз и их
 * дрейф. По ним сверяются пороги согласия полос и порог дрейфа перспективы,
 * поэтому числа печатаются как есть, а не пересчитываются из засева.
 *
 * Отказ ступени печатается отдельно от её незапуска: на снимке, ради разбора
 * которого строка и заведена, шагов нет в обоих случаях, а причина разная —
 * профиль по кадру взял порог или полосы не сошлись.
 */
const describeBanded = (banded: SheetPhotoBandedReport | null): string => {
  if (!banded) {
    return 'полосы не считались: разлиновка не мерилась';
  }

  const { stage, steps, drift } = banded;

  switch (stage) {
    case 'skipped': {
      return 'полосы не понадобились';
    }

    case 'rejected': {
      return 'полосы не сошлись';
    }

    case 'measured': {
      const stepsText = steps
        .map((step) => {
          return step.toFixed(2);
        })
        .join('/');

      return `полосы: шаги ${stepsText} px, дрейф ${(drift * 100).toFixed(2)} %`;
    }

    default: {
      throw new Error(`Unknown banded stage: ${stage}`);
    }
  }
};

/**
 * Имя порога, связавшего кандидата полосового опроса линии поля.
 *
 * @param threshold — порог барьера; `null` — опроса не было
 * @returns имя порога для строки отчёта
 */
const describeMarginLineThreshold = (threshold: MarginLineThreshold | null): string => {
  switch (threshold) {
    case 'peers': {
      return 'соседи';
    }

    case 'sigma': {
      return 'сигма';
    }

    case 'minimum': {
      return 'минимум';
    }

    case null: {
      return 'нет';
    }

    default: {
      throw new Error(`Unknown margin line threshold: ${threshold}`);
    }
  }
};

/**
 * Ступень, которой досталась линия поля, и числа полосового опроса: охват
 * полос, отношение глубины кандидата к глубине соседей и имя связавшего
 * порога. Барьер складывается из трёх порогов, и без его имени калибровка
 * крутила бы множитель, который на снимке ничего не решает.
 *
 * Отказ опроса печатается отдельно от его незапуска: линии поля нет в обоих
 * случаях, а причина разная — кандидат не взял барьер или за ним не ходили.
 *
 * @param report — отчёт поиска линии поля
 * @returns скобочная часть строки линии поля
 */
const describeMarginLineStage = ({
  coverage,
  ratio,
  stage,
  threshold,
}: MarginLineReport): string => {
  const numbers = `охват ${(coverage * 100).toFixed(0)} %, отношение ${ratio.toFixed(2)}, барьер ${describeMarginLineThreshold(threshold)}`;

  switch (stage) {
    case 'profile': {
      return 'профиль';
    }

    case 'banded': {
      return `полосы: ${numbers}`;
    }

    case 'none': {
      return threshold === null ? 'полосы не звались' : `полосы отвергли: ${numbers}`;
    }

    default: {
      throw new Error(`Unknown margin line stage: ${stage}`);
    }
  }
};

/**
 * Перспектива: шаг у крайних линий области и дрейф шага сверху вниз. Без
 * перспективы — расхождение гребёнок в долях шага: по нему видно, насколько
 * лист был далёк от порога.
 */
const describePerspective = (
  ruling: SheetRuling,
  measurement: SheetPhotoMeasurement
): string => {
  const report = measurement.diagnostics.perspective;

  if (!report) {
    return 'перспектива не мерилась';
  }

  const { topStep, bottomStep, deviation, isRectifiedRulingMissing } = report;
  const stepsText = `шаг вверху ${topStep.toFixed(2)} px, внизу ${bottomStep.toFixed(2)} px`;
  const driftText =
    topStep > 0 ? `дрейф ${((bottomStep / topStep - 1) * 100).toFixed(2)} %` : 'дрейф —';
  const deviationText = `расхождение гребёнок ${(deviation / ruling.step).toFixed(3)} шага`;

  if (ruling.perspective) {
    return `перспектива: ${stepsText}, ${driftText}, ${deviationText}`;
  }

  const reasonText = isRectifiedRulingMissing
    ? ', разлиновка на выпрямленной копии не нашлась'
    : '';

  return `перспективы нет (${deviationText}, ${stepsText}, ${driftText}${reasonText})`;
};

/**
 * Изгиб: наибольший отход линии от прямой гребёнки в долях шага и доля
 * найденных узлов — по ним видно, насколько лист изогнут и почему изгиб
 * отброшен. Отход — тот же, по которому проверка надёжности решает сохранить
 * изгиб, с краями области за крайними узлами: наибольшее смещение узла на дуге
 * под наклоном ниже порога, хотя изгиб сохранён.
 */
const describeBend = (ruling: SheetRuling, foundNodeShare: number): string => {
  const { bend, step } = ruling;
  const nodesText = `узлов найдено ${Math.round(foundNodeShare * 100)} %`;

  if (!bend) {
    return `изгиба нет (${nodesText})`;
  }

  const deviation = measureBendDeviation(bend.offsets, bend.columnCount);

  return `изгиб до ${(deviation / step).toFixed(3)} шага (${nodesText})`;
};

/**
 * Части отчёта по листу: всё, что попадает в разлиновку, и решения измерения,
 * — чтобы сверить их с фотографией, не открывая json. Поле, взятое фолбэком,
 * помечено `*`.
 *
 * @param input — измерение, собранная разлиновка, кадр и время
 * @returns части отчёта в порядке печати
 */
export const describeSheetReport = ({
  measurement,
  ruling,
  frame,
  elapsedMs,
}: SheetReportInput): string[] => {
  const { source, diagnostics, lighting } = measurement;
  const { step, firstLinePhase, skewAngle, margins, marginLineX, marginLineSide } =
    ruling;
  const marginsText = MARGIN_SIDES.map((side) => {
    return `${margins[side].toFixed(1)}${source.margins?.[side] ? '' : '*'}`;
  }).join('/');
  const marginLineText =
    marginLineX === null ? 'нет' : `${marginLineX.toFixed(1)} px, ${marginLineSide}`;

  return [
    describeOutline(measurement.outline, frame),
    `вид ${diagnostics.kind}`,
    `шаг ${step.toFixed(2)} px`,
    describeBanded(diagnostics.banded),
    `фаза ${firstLinePhase.toFixed(1)} px`,
    `угол ${skewAngle.toFixed(2)}°`,
    describePerspective(ruling, measurement),
    `поля сверху/справа/снизу/слева ${marginsText}`,
    `линия поля ${marginLineText} (${describeMarginLineStage(diagnostics.marginLine)})`,
    describeBend(ruling, diagnostics.bendFoundNodeShare),
    `свет ${lighting.isUsable ? 'пригоден' : 'непригоден'} (контраст ${lighting.contrast.toFixed(3)})`,
    `время ${Math.round(elapsedMs)} мс`,
  ];
};
