import { type DetectedRuling, detectRuling } from './detectRuling';
import { detectRulingPerspective } from './detectRulingPerspective';
import type { RulingPerspectiveDetection } from './detectRulingPerspective.types';
import { detectSheetOutline } from './detectSheetOutline';
import { extractLighting } from './extractLighting';
import { extractTexture } from './extractTexture';
import type {
  SheetPhotoMeasurement,
  SheetPhotoOptions,
  SheetPhotoPerspectiveReport,
} from './measureSheetPhoto.types';
import { rectifySheetImage } from './measureSheetPhotoRectify';
import type {
  PaperMargins,
  RulingBend,
  RulingProjection,
  SheetImageData,
  SheetOutline,
  SheetRulingSource,
} from './paper.types';
import { resolveSheetBounds } from './resolveSheetBounds';
import { lineHeightAt, lineHeightScaleAt } from './rulingPerspective';

const DEGREES_IN_RADIAN = 180 / Math.PI;

/**
 * Смещения изгиба хранятся кратными сотой пикселя, как их отдаёт детектор.
 */
const OFFSET_PRECISION = 100;

/**
 * Вырезка внутри листа и её место в кадре.
 */
type SheetCrop = {
  /**
   * Полутоновая выжимка вырезки.
   */
  image: SheetImageData;

  /**
   * Отступ вырезки от левого края кадра, px.
   */
  left: number;

  /**
   * Отступ вырезки от верхнего края кадра, px.
   */
  top: number;
};

/**
 * Как результат детектора разлиновки ложится в кадр.
 */
type FrameTransfer = {
  /**
   * Сдвиг по горизонтали из пикселей анализа в пиксели кадра.
   */
  left: number;

  /**
   * Сдвиг координаты вдоль линий из анализа в кадр.
   */
  lineShift: number;

  /**
   * Ширина кадра, px.
   */
  frameWidth: number;

  /**
   * Наклон и перспектива в пикселях кадра.
   */
  projection: RulingProjection;

  /**
   * Верхнее поле кадра по координате вдоль линий анализа.
   *
   * @param top — найденное верхнее поле анализа
   * @returns верхнее поле кадра
   */
  toTop: (top: number) => number;

  /**
   * Нижнее поле кадра по нижнему полю анализа.
   *
   * @param bottom — найденное нижнее поле анализа
   * @returns нижнее поле кадра
   */
  toBottom: (bottom: number) => number;
};

/**
 * Верх и высота выпрямленной копии.
 */
type RectifiedSpan = {
  /**
   * Координата вдоль линий вырезки у верхней строки копии.
   */
  top: number;

  /**
   * Высота копии, px.
   */
  height: number;
};

/**
 * Разлиновка кадра вместе с проходом, который её дал.
 */
type RulingMeasurement = {
  /**
   * Разлиновка в пикселях кадра.
   */
  source: SheetRulingSource;

  /**
   * Итоговый проход детектора: второй, если он состоялся, иначе ровный.
   */
  detection: DetectedRuling;

  /**
   * Отчёт перспективы; `null` — разлиновка не найдена.
   */
  report: SheetPhotoPerspectiveReport | null;
};

const MISSING_REPORT: SheetPhotoPerspectiveReport | null = null;

/**
 * Координата вдоль линий по модулю шага, в `[0, step)`.
 *
 * @param value — координата
 * @param step — шаг, больше нуля
 * @returns приведённая координата
 */
const wrapPhase = (value: number, step: number): number => {
  return ((value % step) + step) % step;
};

/**
 * Вырезает прямоугольник, вписанный в контур листа. Лист во весь кадр
 * отдаётся без копии: обрезанная фотография разбирается так же, как без
 * поиска контура, и не платит за лишний проход по пикселям.
 *
 * @param image — полутоновая выжимка кадра
 * @param outline — контур листа
 * @returns вырезка и её отступы в кадре
 */
const cropSheet = (image: SheetImageData, outline: SheetOutline | null): SheetCrop => {
  const { width, height, luminance } = image;
  const bounds = resolveSheetBounds(outline, width, height);
  const left = Math.min(width, Math.max(0, Math.ceil(bounds.left)));
  const top = Math.min(height, Math.max(0, Math.ceil(bounds.top)));
  const right = Math.max(left, Math.min(width, Math.floor(width - bounds.right)));
  const bottom = Math.max(top, Math.min(height, Math.floor(height - bounds.bottom)));
  const cropWidth = right - left;
  const cropHeight = bottom - top;

  if (cropWidth === width && cropHeight === height) {
    return { image, left: 0, top: 0 };
  }

  const values = new Float32Array(cropWidth * cropHeight);

  for (let row = 0; row < cropHeight; row += 1) {
    const from = (top + row) * width + left;

    values.set(luminance.subarray(from, from + cropWidth), row * cropWidth);
  }

  return {
    image: { width: cropWidth, height: cropHeight, luminance: values },
    left,
    top,
  };
};

/**
 * Переводит поля, линию поля и изгиб из пикселей анализа в пиксели кадра.
 * Ненайденная сторона остаётся нулём: фолбэк от стороны листа посчитает сборка
 * разлиновки.
 *
 * @param detection — результат детектора разлиновки
 * @param analysisWidth — ширина изображения, ушедшего в детектор
 * @param transfer — перевод в кадр
 * @returns разлиновка кадра без контура
 */
const toFrameSource = (
  detection: DetectedRuling,
  analysisWidth: number,
  transfer: FrameTransfer
): SheetRulingSource => {
  const { step, margins, marginLineX, marginLineSide, bend } = detection;
  const { left, lineShift, frameWidth, projection } = transfer;
  const frameMargins: PaperMargins = {
    top: margins.top ? transfer.toTop(margins.top) : 0,
    right: margins.right ? frameWidth - left - analysisWidth + margins.right : 0,
    bottom: margins.bottom ? transfer.toBottom(margins.bottom) : 0,
    left: margins.left ? left + margins.left : 0,
  };

  return {
    step,
    firstLinePhase: wrapPhase(detection.firstLinePhase + lineShift, step),
    skewAngle: projection.skewAngle,
    margins: frameMargins,
    marginLineX: marginLineX === null ? null : marginLineX + left,
    marginLineSide,
    bend: bend && toFrameBend(bend, transfer),
    perspective: projection.perspective,
  };
};

/**
 * Переводит сетку изгиба в кадр. Строки узлов лежат по координате вдоль линий
 * и сдвигаются вместе с ней. Смещения мерились в пикселях анализа по высоте, а
 * хранятся в пикселях фото: у выпрямленной копии пиксель по высоте — единица
 * координаты вдоль линий, и смещение домножается на местный масштаб `∂Y/∂U` в
 * своём узле.
 *
 * @param bend — изгиб в пикселях анализа
 * @param transfer — перевод в кадр
 * @returns изгиб в пикселях кадра
 */
const toFrameBend = (bend: RulingBend, transfer: FrameTransfer): RulingBend => {
  const { projection } = transfer;
  const columnOrigin = bend.columnOrigin + transfer.left;
  const rowOrigin = bend.rowOrigin + transfer.lineShift;

  if (!projection.perspective) {
    return { ...bend, columnOrigin, rowOrigin };
  }

  const offsets = bend.offsets.map((offset, index) => {
    const column = index % bend.columnCount;
    const row = Math.floor(index / bend.columnCount);
    const scale = lineHeightScaleAt(
      projection,
      columnOrigin + column * bend.columnSpacing,
      rowOrigin + row * bend.rowSpacing
    );

    return Math.round(offset * scale * OFFSET_PRECISION) / OFFSET_PRECISION;
  });

  return { ...bend, columnOrigin, rowOrigin, offsets };
};

/**
 * Перевод ровного прохода по вырезке. Координата вдоль линий `y − x·tgθ`
 * вырезки отличается от кадровой на `T − L·tgθ`; поля по высоте — тоже
 * координаты вдоль линий у левого края, поэтому сдвигаются на то же число.
 *
 * @param crop — вырезка
 * @param frame — кадр
 * @param skewAngle — наклон разлиновки
 * @returns перевод в кадр
 */
const toFlatTransfer = (
  crop: SheetCrop,
  frame: SheetImageData,
  skewAngle: number
): FrameTransfer => {
  const lineShift = crop.top - crop.left * Math.tan(skewAngle / DEGREES_IN_RADIAN);
  const cropBottom = frame.height - crop.top - crop.image.height;

  return {
    left: crop.left,
    lineShift,
    frameWidth: frame.width,
    projection: { skewAngle, perspective: null },
    toTop: (top) => {
      return top + lineShift;
    },
    toBottom: (bottom) => {
      return cropBottom + bottom + crop.top - lineShift;
    },
  };
};

/**
 * Перевод второго прохода по выпрямленной копии. Строка копии — координата
 * вдоль линий вырезки от `top` копии, дальше — тот же сдвиг, что у ровного
 * прохода. Поля по высоте хранятся в пикселях фото у левого края кадра, и
 * координата вдоль линий переводится в высоту по перспективе.
 *
 * @param crop — вырезка
 * @param frame — кадр
 * @param detection — перспектива в пикселях вырезки
 * @param rectified — верх и высота выпрямленной копии
 * @returns перевод в кадр
 */
const toRectifiedTransfer = (
  crop: SheetCrop,
  frame: SheetImageData,
  detection: RulingPerspectiveDetection,
  rectified: RectifiedSpan
): FrameTransfer => {
  const { skewAngle, perspective } = detection;
  const lineShift =
    rectified.top + crop.top - crop.left * Math.tan(skewAngle / DEGREES_IN_RADIAN);
  const projection: RulingProjection = {
    skewAngle,
    perspective: perspective && {
      ...perspective,
      originX: perspective.originX + crop.left,
      originY: perspective.originY + crop.top,
    },
  };

  return {
    left: crop.left,
    lineShift,
    frameWidth: frame.width,
    projection,
    toTop: (top) => {
      return lineHeightAt(projection, 0, top + lineShift);
    },
    toBottom: (bottom) => {
      return (
        frame.height - lineHeightAt(projection, 0, rectified.height - bottom + lineShift)
      );
    },
  };
};

/**
 * Разлиновка вырезки: ровный проход, перспектива и, если она есть, второй
 * проход по выпрямленной копии.
 *
 * @param image — полутоновая выжимка кадра
 * @param crop — вырезка внутри листа
 * @returns разлиновка кадра, итоговый проход и отчёт перспективы
 */
const measureRuling = (image: SheetImageData, crop: SheetCrop): RulingMeasurement => {
  const flat = detectRuling(crop.image);

  if (!flat.isDetected || flat.step <= 0) {
    return {
      source: { step: 0, firstLinePhase: 0, skewAngle: flat.skewAngle },
      detection: flat,
      report: MISSING_REPORT,
    };
  }

  const flatSource = toFrameSource(
    flat,
    crop.image.width,
    toFlatTransfer(crop, image, flat.skewAngle)
  );
  const perspective = detectRulingPerspective(crop.image, flat, {
    left: crop.left,
    top: crop.top,
    width: image.width,
    height: image.height,
  });
  const report: SheetPhotoPerspectiveReport = {
    foundNodeShare: perspective.foundNodeShare,
    topStep: perspective.topStep,
    bottomStep: perspective.bottomStep,
    deviation: perspective.deviation,
    isRectifiedRulingMissing: false,
  };

  if (!perspective.perspective) {
    return { source: flatSource, detection: flat, report };
  }

  /**
   * Копия выпрямляется уточнённым наклоном: он подогнан вместе со схождением,
   * и с наклоном ровного прохода линии копии встали бы мимо гребёнки.
   */
  const rectified = rectifySheetImage(crop.image, {
    skewAngle: perspective.skewAngle,
    perspective: perspective.perspective,
  });
  const second =
    rectified.image.height > 0
      ? detectRuling(rectified.image, { skewAngle: perspective.skewAngle })
      : null;

  if (!second || !second.isDetected || second.step <= 0) {
    return {
      source: flatSource,
      detection: flat,
      report: { ...report, isRectifiedRulingMissing: true },
    };
  }

  return {
    source: toFrameSource(
      second,
      rectified.image.width,
      toRectifiedTransfer(crop, image, perspective, {
        top: rectified.top,
        height: rectified.image.height,
      })
    ),
    detection: second,
    report,
  };
};

/**
 * Измеряет фотографию листа одним путём для импорта, перемера и пресетов:
 * контур, разлиновку с перспективой и изгибом, поле освещения и карту текстуры.
 *
 * Разлиновка ищется только в прямоугольнике, вписанном в контур листа, и
 * переводится в пиксели кадра: поверхность вокруг листа не сбивает ни шаг, ни
 * поля. Неудача разлиновки не отбрасывает фотографию: контур, свет и текстура
 * остаются, а разлиновка приходит с нулевым шагом — лист уходит в ручной ввод.
 *
 * @param image — полутоновая выжимка фотографии
 * @param options — вид разлиновки семьи и ручной контур
 * @returns измерения в пикселях кадра
 */
export const measureSheetPhoto = (
  image: SheetImageData,
  options: SheetPhotoOptions
): SheetPhotoMeasurement => {
  const outline =
    options.outline === undefined ? detectSheetOutline(image) : options.outline;
  const lighting = extractLighting(image, { outline });
  const textureMap = extractTexture(image, lighting, { outline });
  const crop = cropSheet(image, outline);
  const shouldMeasureRuling =
    options.kind !== 'blank' && crop.image.width > 1 && crop.image.height > 1;

  if (!shouldMeasureRuling) {
    return {
      source: { step: 0, firstLinePhase: 0, skewAngle: 0, outline },
      outline,
      lighting,
      textureMap,
      diagnostics: {
        isRulingDetected: false,
        confidence: 0,
        kind: 'blank',
        bendFoundNodeShare: 0,
        perspective: MISSING_REPORT,
      },
    };
  }

  const { source, detection, report } = measureRuling(image, crop);

  return {
    source: { ...source, outline },
    outline,
    lighting,
    textureMap,
    diagnostics: {
      isRulingDetected: detection.isDetected,
      confidence: detection.confidence,
      kind: detection.kind,
      bendFoundNodeShare: detection.bendFoundNodeShare,
      perspective: report,
    },
  };
};
