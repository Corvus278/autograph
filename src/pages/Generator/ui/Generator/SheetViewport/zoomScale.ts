import type { FitZoomInput, ZoomDirection } from './zoomScale.types';

/**
 * Самый мелкий масштаб — десятая доля пикселей кадра.
 */
export const ZOOM_MIN = 0.1;

/**
 * Самый крупный масштаб — четыре экранных пикселя на пиксель кадра: крупнее
 * фотография листа уже не даёт деталей, только размытые пиксели.
 */
export const ZOOM_MAX = 4;

/**
 * Отношение соседних ступеней: два шага удваивают масштаб.
 */
const LADDER_RATIO = Math.SQRT2;

/**
 * Ступени округляются до целого процента: подпись масштаба показывает ровное
 * число, а не 35,4 %.
 */
const PERCENT = 100;

/**
 * Допуск сравнения масштаба со ступенью: масштаб, пришедший из вписывания или
 * колеса, может отличаться от ступени на погрешность счёта, и шаг от него не
 * должен топтаться на месте.
 */
const STEP_EPSILON = 1e-6;

/**
 * Строит геометрическую лестницу от 100 % в обе стороны до границ масштаба.
 *
 * @returns ступени масштаба по возрастанию
 */
const buildZoomLadder = (): number[] => {
  const lowestPower = Math.floor(Math.log(ZOOM_MIN) / Math.log(LADDER_RATIO));
  const highestPower = Math.ceil(Math.log(ZOOM_MAX) / Math.log(LADDER_RATIO));
  const steps: number[] = [ZOOM_MIN];

  for (let power = lowestPower; power <= highestPower; power += 1) {
    const step = Math.round(LADDER_RATIO ** power * PERCENT) / PERCENT;

    if (step > ZOOM_MIN && step < ZOOM_MAX) {
      steps.push(step);
    }
  }

  steps.push(ZOOM_MAX);

  return steps;
};

/**
 * Ступени кнопок масштаба по возрастанию: от 10 до 400 %, соседние отличаются
 * в √2 раз.
 */
export const ZOOM_LADDER: readonly number[] = buildZoomLadder();

/**
 * Держит масштаб внутри лестницы.
 *
 * @param zoom — масштаб в долях пикселей кадра
 * @returns масштаб от `ZOOM_MIN` до `ZOOM_MAX`
 */
export const clampZoom = (zoom: number): number => {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom));
};

/**
 * Следующая ступень лестницы от текущего масштаба. Масштаб между ступенями —
 * после вписывания или колеса — уходит на ближайшую ступень в сторону шага, а
 * не на ступень дальше неё.
 *
 * @param zoom — текущий масштаб
 * @param direction — в какую сторону шагнуть
 * @returns новый масштаб; на краю лестницы — край
 */
export const stepZoom = (zoom: number, direction: ZoomDirection): number => {
  switch (direction) {
    case 1: {
      return (
        ZOOM_LADDER.find((step) => {
          return step > zoom + STEP_EPSILON;
        }) || ZOOM_MAX
      );
    }

    case -1: {
      return ZOOM_LADDER.reduce((lower, step) => {
        return step < zoom - STEP_EPSILON ? step : lower;
      }, ZOOM_MIN);
    }

    default: {
      throw new Error(`Неизвестное направление шага: ${String(direction)}`);
    }
  }
};

/**
 * Масштаб, при котором лист целиком помещается в область просмотра с
 * отступами. Держится внутри лестницы: область меньше десятой доли листа
 * бывает только пока она не измерена, и холст нулевого размера в ней ничего бы
 * не показал.
 *
 * @param input — размеры области и листа
 * @returns вписанный масштаб
 */
export const computeFitZoom = (input: FitZoomInput): number => {
  const { viewportWidth, viewportHeight, pageWidth, pageHeight, padding } = input;
  const availableWidth = viewportWidth - 2 * padding;
  const availableHeight = viewportHeight - 2 * padding;

  if (pageWidth <= 0 || pageHeight <= 0) {
    return ZOOM_MIN;
  }

  return clampZoom(Math.min(availableWidth / pageWidth, availableHeight / pageHeight));
};

/**
 * Разрешение основного растра: не крупнее вписанного. Крупнее рисует воркер,
 * а основной поток рисует лист при каждом наборе символа, и полноразмерный кадр
 * замораживал бы ввод.
 *
 * @param zoom — текущий масштаб
 * @param fitZoom — вписанный масштаб
 * @param pixelRatio — плотность экрана
 * @returns множитель разрешения основного растра
 */
export const computeMainRasterScale = (
  zoom: number,
  fitZoom: number,
  pixelRatio: number
): number => {
  return Math.min(zoom, fitZoom) * pixelRatio;
};

/**
 * Разрешение детального растра: сколько нужно текущему масштабу, но не больше
 * пикселей кадра — выше детализации взять неоткуда.
 *
 * @param zoom — текущий масштаб
 * @param fitZoom — вписанный масштаб
 * @param pixelRatio — плотность экрана
 * @returns множитель разрешения; `null` — основного растра достаточно
 */
export const computeDetailRasterScale = (
  zoom: number,
  fitZoom: number,
  pixelRatio: number
): number | null => {
  const detailScale = Math.min(zoom * pixelRatio, 1);

  if (detailScale <= computeMainRasterScale(zoom, fitZoom, pixelRatio) + STEP_EPSILON) {
    return null;
  }

  return detailScale;
};
