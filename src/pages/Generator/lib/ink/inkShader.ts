import type { LightingField } from '../paper/paper.types';
import { synthesizeLighting } from '../paper/synthesizeLighting';

import type { InkLayerParams, InkModulationOptions } from './ink.types';
import { NEUTRAL_TEXTURE_VALUE, resolveInkModulation } from './modulateInkSample';

/**
 * Канва, на которую лёг результат прохода. В воркере элемента `canvas` нет,
 * поэтому тип допускает и `OffscreenCanvas`.
 */
export type InkLayerSurface = HTMLCanvasElement | OffscreenCanvas;

/**
 * Канва прохода вместе с её контекстом.
 */
type InkGlSurface = {
  /**
   * Канва, в которую пишет проход.
   */
  canvas: InkLayerSurface;

  /**
   * Контекст рисования этой канвы.
   */
  gl: WebGLRenderingContext;
};

/**
 * Вершины полноэкранного треугольника: один примитив вместо двух, шов по
 * диагонали квада отсутствует по построению.
 */
const FULLSCREEN_TRIANGLE = new Float32Array([-1, -1, 3, -1, -1, 3]);

/**
 * Единицы, к которым привязаны сэмплеры.
 */
const INK_UNIT = 0;
const LIGHTING_UNIT = 1;
const TEXTURE_UNIT = 2;

/**
 * Вершинный шейдер переворачивает текстурную координату по вертикали: у канвы
 * первая строка пикселей верхняя, а у кадрового буфера верх — это `y = 1`.
 * Переворот один и общий для всех трёх текстур, поэтому слой чернил, поле
 * освещения и карта текстуры остаются совмещёнными.
 */
export const INK_VERTEX_SHADER = `
attribute vec2 aPosition;
varying vec2 vUv;

void main() {
  vUv = vec2(aPosition.x * 0.5 + 0.5, 0.5 - aPosition.y * 0.5);
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

/**
 * Записывает число в форме литерала GLSL: без точки `0.35` разберётся, а
 * целое `1` — уже нет, это `int` и умножение на `float` не скомпилируется.
 */
const toGlslFloat = (value: number): string => {
  return Number.isInteger(value) ? value.toFixed(1) : String(value);
};

/**
 * Собирает фрагментный шейдер модуляции чернил.
 *
 * Тело шейдера — построчный перевод `inkGain` из `modulateInkSample.ts`, а
 * коэффициенты подставляются из того же `resolveInkModulation`, что и на CPU.
 * Формула обязана быть одна: предпросмотр и экспорт идут этим проходом, и
 * любое расхождение между шейдером и CPU-формулой — это расхождение картинки
 * на экране и картинки в файле, то есть прямое нарушение требования об их
 * совпадении. Правка формулы начинается с `modulateInkSample.ts` и
 * заканчивается здесь.
 *
 * Выборка поля освещения совпадает с `sampleLightingField`: координата
 * приводится к центрам текселей, поэтому узел сетки читается точно, а между
 * узлами железо интерполирует билинейно — как и CPU-выборка.
 *
 * @param options — отклонения от коэффициентов по умолчанию
 * @returns исходный текст фрагментного шейдера
 */
export const buildInkFragmentShader = (options?: InkModulationOptions): string => {
  const { lightInfluence, textureInfluence, minGain } = resolveInkModulation(options);

  return `
precision mediump float;

varying vec2 vUv;

uniform sampler2D uInk;
uniform sampler2D uLighting;
uniform sampler2D uTexture;
uniform vec2 uLightingGrid;
uniform float uHasTexture;

const float LIGHT_INFLUENCE = ${toGlslFloat(lightInfluence)};
const float TEXTURE_INFLUENCE = ${toGlslFloat(textureInfluence)};
const float MIN_GAIN = ${toGlslFloat(minGain)};
const float MAX_GAIN = 1.0;
const float NEUTRAL_TEXTURE = ${toGlslFloat(NEUTRAL_TEXTURE_VALUE)};

void main() {
  vec4 ink = texture2D(uInk, vUv);
  vec2 lightingUv = (vUv * (uLightingGrid - 1.0) + 0.5) / uLightingGrid;
  float lighting = clamp(texture2D(uLighting, lightingUv).r, 0.0, 1.0);
  float sampled = clamp(texture2D(uTexture, vUv).r * 2.0 - 1.0, -1.0, 1.0);
  float grain = mix(NEUTRAL_TEXTURE, sampled, uHasTexture);
  float lightGain = 1.0 - LIGHT_INFLUENCE * (1.0 - lighting);
  float textureGain = 1.0 - TEXTURE_INFLUENCE * (1.0 - grain) * 0.5;
  float gain = clamp(lightGain * textureGain, MIN_GAIN, MAX_GAIN);

  gl_FragColor = vec4(ink.rgb * gain, ink.a);
}
`;
};

/**
 * Компилирует шейдер. `null` — исходник не собрался.
 */
const compileShader = (
  gl: WebGLRenderingContext,
  type: number,
  source: string
): WebGLShader | null => {
  const shader = gl.createShader(type);

  if (!shader) {
    return null;
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);

    return null;
  }

  return shader;
};

/**
 * Собирает программу из пары шейдеров. `null` — что-то не собралось или не
 * слинковалось.
 */
const createProgram = (
  gl: WebGLRenderingContext,
  fragmentSource: string
): WebGLProgram | null => {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, INK_VERTEX_SHADER);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();

  if (!vertex || !fragment || !program) {
    return null;
  }

  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);

    return null;
  }

  return program;
};

/**
 * Создаёт текстуру с билинейной фильтрацией и зажатыми краями: поле освещения
 * продолжается за границей листа своим краем, а не повторяется.
 */
const createTexture = (gl: WebGLRenderingContext, unit: number): WebGLTexture | null => {
  const texture = gl.createTexture();

  if (!texture) {
    return null;
  }

  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  return texture;
};

/**
 * Раскладывает поле освещения в пиксели: яркость узла кладётся во все каналы
 * байтом. Байта хватает — поле низкочастотное, и шаг 1/255 в нём меньше
 * разницы между соседними узлами.
 */
const toLightingPixels = (field: LightingField): Uint8Array => {
  const { gridWidth, gridHeight, values } = field;
  const pixels = new Uint8Array(gridWidth * gridHeight * 4);

  for (let index = 0; index < gridWidth * gridHeight; index += 1) {
    const level = Math.round(Math.min(Math.max(values[index] || 0, 0), 1) * 255);
    const offset = index * 4;

    pixels[offset] = level;
    pixels[offset + 1] = level;
    pixels[offset + 2] = level;
    pixels[offset + 3] = 255;
  }

  return pixels;
};

/**
 * Создаёт канву с контекстом WebGL. `null` — контекста нет: ни на элементе, ни
 * на `OffscreenCanvas`.
 */
const createSurface = (width: number, height: number): InkGlSurface | null => {
  const attributes: WebGLContextAttributes = {
    alpha: true,
    antialias: false,
    premultipliedAlpha: false,
    /**
     * Результат прохода забирает вызывающая сторона отдельным `drawImage`,
     * поэтому буфер обязан пережить конец кадра.
     */
    preserveDrawingBuffer: true,
  };

  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');

    canvas.width = width;
    canvas.height = height;

    const gl = canvas.getContext('webgl', attributes);

    return gl ? { canvas, gl } : null;
  }

  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height);
    const gl = canvas.getContext('webgl', attributes);

    return gl ? { canvas, gl } : null;
  }

  return null;
};

/**
 * Выбирает поле освещения для прохода: своё, если оно пригодно, иначе
 * синтетическое. Непригодное поле — это скан или равномерная заливка, и
 * оставлять по нему чернила ровными нельзя: ровный след по всему листу и есть
 * главный признак отрисовки.
 *
 * @param lighting — поле экземпляра листа
 * @param width — ширина слоя в пикселях
 * @param height — высота слоя в пикселях
 * @param seed — seed прогона
 * @returns поле освещения, пригодное к использованию
 */
export const resolveInkLighting = (
  lighting: LightingField | null,
  width: number,
  height: number,
  seed: number
): LightingField => {
  if (
    lighting &&
    lighting.isUsable &&
    0 < lighting.gridWidth &&
    0 < lighting.gridHeight
  ) {
    return lighting;
  }

  return synthesizeLighting(width, height, seed);
};

/**
 * Модулирует отрисованный слой чернил освещением и текстурой листа одним
 * проходом на GPU.
 *
 * Возвращает канву с результатом — вызывающая сторона кладёт её обратно на
 * страницу сама. `null` означает, что прохода не было: WebGL недоступен или
 * программа не собралась. Это не ошибка отрисовки: чернила в этом случае
 * остаются непромодулированными, и страница всё равно рисуется.
 *
 * @param params — слой чернил, его размеры, поле освещения, карта текстуры и
 *   seed прогона
 * @returns канва с промодулированными чернилами или `null`
 */
export const modulateInkLayer = (params: InkLayerParams): InkLayerSurface | null => {
  const { inkLayer, width, height, lighting, textureImage, seed, options } = params;

  if (0 >= width || 0 >= height) {
    return null;
  }

  const surface = createSurface(width, height);

  if (!surface) {
    return null;
  }

  const { canvas, gl } = surface;
  const program = createProgram(gl, buildInkFragmentShader(options));

  if (!program) {
    return null;
  }

  const buffer = gl.createBuffer();
  const inkTexture = createTexture(gl, INK_UNIT);
  const lightingTexture = createTexture(gl, LIGHTING_UNIT);
  const textureMap = createTexture(gl, TEXTURE_UNIT);

  if (!buffer || !inkTexture || !lightingTexture || !textureMap) {
    return null;
  }

  const field = resolveInkLighting(lighting, width, height, seed);

  gl.activeTexture(gl.TEXTURE0 + INK_UNIT);
  gl.bindTexture(gl.TEXTURE_2D, inkTexture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, inkLayer);

  gl.activeTexture(gl.TEXTURE0 + LIGHTING_UNIT);
  gl.bindTexture(gl.TEXTURE_2D, lightingTexture);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    field.gridWidth,
    field.gridHeight,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    toLightingPixels(field)
  );

  gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT);
  gl.bindTexture(gl.TEXTURE_2D, textureMap);

  if (textureImage) {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, textureImage);
  } else {
    /**
     * Заглушка белым: сэмплер обязан быть привязан к текстуре, даже когда
     * карты нет. Белый пиксель декодируется в нейтральное отклонение — то же,
     * что подставит `uHasTexture`.
     */
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array([255, 255, 255, 255])
    );
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, FULLSCREEN_TRIANGLE, gl.STATIC_DRAW);
  gl.useProgram(program);

  const position = gl.getAttribLocation(program, 'aPosition');

  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  gl.uniform1i(gl.getUniformLocation(program, 'uInk'), INK_UNIT);
  gl.uniform1i(gl.getUniformLocation(program, 'uLighting'), LIGHTING_UNIT);
  gl.uniform1i(gl.getUniformLocation(program, 'uTexture'), TEXTURE_UNIT);
  gl.uniform2f(
    gl.getUniformLocation(program, 'uLightingGrid'),
    Math.max(1, field.gridWidth),
    Math.max(1, field.gridHeight)
  );
  gl.uniform1f(gl.getUniformLocation(program, 'uHasTexture'), textureImage ? 1 : 0);

  gl.viewport(0, 0, width, height);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLES, 0, 3);

  gl.deleteBuffer(buffer);
  gl.deleteTexture(inkTexture);
  gl.deleteTexture(lightingTexture);
  gl.deleteTexture(textureMap);
  gl.deleteProgram(program);

  return canvas;
};
