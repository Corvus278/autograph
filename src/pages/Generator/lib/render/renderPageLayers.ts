import type { InkLayerParams } from '../ink/ink.types';
import { modulateInkLayer } from '../ink/inkShader';

import type {
  CreateInkLayer,
  InkLayerImage,
  PageRenderParams,
  RenderContext,
} from './render.types';
import {
  drawPageBackground,
  drawPageInk,
  renderPageToCanvas,
} from './renderPageToCanvas';

/**
 * Размер снимка в пикселях: слой чернил делается ровно таким же, иначе он не
 * ляжет на страницу пиксель в пиксель.
 */
export type PageLayerSize = {
  /**
   * Ширина снимка в пикселях.
   */
  width: number;

  /**
   * Высота снимка в пикселях.
   */
  height: number;
};

/**
 * Чем рисуется и чем модулируется слой чернил. Обе зависимости подменяются в
 * тестах: настоящего WebGL там нет, а проверять нужно именно композицию.
 */
export type PageLayersDeps = {
  /**
   * Создаёт слой чернил. `null` — отдельного слоя не будет.
   */
  createLayer: CreateInkLayer;

  /**
   * Прогоняет слой чернил через шейдер. `null` — прохода не было.
   */
  modulate: (params: InkLayerParams) => InkLayerImage | null;
};

/**
 * Поддержка WebGL: проверяется один раз за сеанс. `null` — ещё не проверяли.
 */
let isWebglSupported: boolean | null = null;

/**
 * Есть ли в этом окружении WebGL. Проверка идёт на канве размером в пиксель:
 * страничный слой стоит десятки мегабайт, и заводить его, чтобы тут же
 * выбросить, дороже, чем один разовый пробный контекст.
 */
const checkWebglSupport = (): boolean => {
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');

    canvas.width = 1;
    canvas.height = 1;

    return Boolean(canvas.getContext('webgl'));
  }

  if (typeof OffscreenCanvas !== 'undefined') {
    return Boolean(new OffscreenCanvas(1, 1).getContext('webgl'));
  }

  return false;
};

/**
 * Слой чернил на канве. `null` — модуляции всё равно не будет, и чернила
 * дешевле нарисовать прямо на страницу: лишний слой без шейдера только
 * потратил бы память и один проход композиции.
 */
const createCanvasInkLayer: CreateInkLayer = (width, height) => {
  if (isWebglSupported === null) {
    isWebglSupported = checkWebglSupport();
  }

  if (!isWebglSupported || 0 >= width || 0 >= height) {
    return null;
  }

  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');

    canvas.width = width;
    canvas.height = height;

    return { context: canvas.getContext('2d'), image: canvas };
  }

  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height);

    return { context: canvas.getContext('2d'), image: canvas };
  }

  return null;
};

const DEFAULT_DEPS: PageLayersDeps = {
  createLayer: createCanvasInkLayer,
  modulate: modulateInkLayer,
};

/**
 * Рисует страницу в два прохода: фотография листа ложится на страницу, чернила
 * — на свой прозрачный слой, и слой возвращается на страницу уже
 * промодулированным освещением и текстурой листа.
 *
 * Разделение проходов вынужденное: шейдеру нужны чернила без листа под ними,
 * иначе он промодулировал бы и фотографию, которая уже несёт своё освещение.
 *
 * Если модуляции не случилось — WebGL нет или программа не собралась — чернила
 * оказываются на странице непромодулированными. Это не ошибка отрисовки:
 * страница рисуется в любом случае.
 *
 * @param ctx — контекст страницы; состояние восстанавливается к исходному
 * @param params — что рисовать, чем и в каком разрешении
 * @param size — размер снимка в пикселях
 * @param deps — чем создавать слой и чем его модулировать
 */
export const renderPageLayers = (
  ctx: RenderContext,
  params: PageRenderParams,
  size: PageLayerSize,
  deps: Partial<PageLayersDeps> = {}
): void => {
  const { createLayer, modulate } = { ...DEFAULT_DEPS, ...deps };
  const { width, height } = size;
  const { lighting, texture, seed } = params.ink;

  const layer = createLayer(width, height);

  if (!layer?.context) {
    renderPageToCanvas(ctx, params);

    return;
  }

  drawPageBackground(ctx, params);
  drawPageInk(layer.context, params);

  const modulated = modulate({
    inkLayer: layer.image,
    width,
    height,
    lighting,
    textureImage: texture,
    seed,
  });

  ctx.drawImage(modulated || layer.image, 0, 0, width, height);
};
