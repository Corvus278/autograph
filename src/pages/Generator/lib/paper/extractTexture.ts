import { percentileOf } from './extractLighting';
import type {
  ExtractTextureOptions,
  LightingField,
  SheetImageData,
  TextureMap,
} from './paper.types';

/**
 * Доля отклонений, которая обязана уложиться в размах карты. Верхние
 * перцентили на реальном листе принадлежат не зерну бумаги, а разлиновке: на
 * `public/paper/lined/1.jpg` при перцентиле 0.995 восемь пикселей из десяти
 * оказываются ниже восьмой части размаха, то есть всё зерно ужимается в
 * полтора десятка уровней из 256.
 *
 * Девятая дециль отдаёт шкалу зерну, а линии и соринки срезает границей. Для
 * шейдера это верный размен: разлиновка — геометрия, она рисуется отдельно, и
 * в карте текстуры ей делать нечего.
 */
const AMPLITUDE_PERCENTILE = 0.9;

/**
 * Предел длинной стороны карты текстуры. Прореживание по умолчанию берётся из
 * него, потому что карта уходит в PNG и дальше в локальное хранилище вместе с
 * профилем листа: снимок на 12 Мп без прореживания дал бы десятки мегабайт
 * шума, который не сжимается. Тысяча с небольшим точек на длинную сторону —
 * около мегабайта в base64 и всё ещё три точки карты на миллиметр листа;
 * мельче — и зерно превращается в равномерную серость.
 */
const TEXTURE_MAP_MAX_SIZE = 1024;

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(max, Math.max(min, value));
};

/**
 * Билинейно интерполирует поле освещения в точке фотографии. Узлы сетки лежат
 * в центрах клеток, поэтому у краёв листа поле продолжается константой — за
 * крайним узлом мерить нечего.
 */
const sampleLighting = (
  lighting: LightingField,
  width: number,
  height: number,
  x: number,
  y: number
): number => {
  const { gridWidth, gridHeight, values } = lighting;
  const gridX = ((x + 0.5) * gridWidth) / width - 0.5;
  const gridY = ((y + 0.5) * gridHeight) / height - 0.5;
  const baseX = Math.floor(gridX);
  const baseY = Math.floor(gridY);
  const fractionX = clamp(gridX - baseX, 0, 1);
  const fractionY = clamp(gridY - baseY, 0, 1);
  const leftColumn = clamp(baseX, 0, gridWidth - 1);
  const rightColumn = clamp(baseX + 1, 0, gridWidth - 1);
  const topRow = clamp(baseY, 0, gridHeight - 1);
  const bottomRow = clamp(baseY + 1, 0, gridHeight - 1);
  const topLeft = values[topRow * gridWidth + leftColumn] || 0;
  const topRight = values[topRow * gridWidth + rightColumn] || 0;
  const bottomLeft = values[bottomRow * gridWidth + leftColumn] || 0;
  const bottomRight = values[bottomRow * gridWidth + rightColumn] || 0;
  const top = topLeft + (topRight - topLeft) * fractionX;
  const bottom = bottomLeft + (bottomRight - bottomLeft) * fractionX;

  return top + (bottom - top) * fractionY;
};

/**
 * Множитель, разворачивающий нормированное поле обратно в яркости снимка.
 * Считается методом наименьших квадратов по всему листу: поле хранит форму
 * света, а не экспозицию, и без подгонки отклонения получили бы постоянную
 * составляющую размером с саму яркость.
 *
 * Точки берутся с шагом прореживания: множитель — одно число на весь лист, и
 * миллион выборок оценивает его не лучше, чем десятки тысяч, зато стоит
 * секунды в основном потоке.
 */
const fitLightingLevel = (
  image: SheetImageData,
  lighting: LightingField,
  step: number
): number => {
  const { width, height, luminance } = image;

  let product = 0;
  let square = 0;

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const expected = sampleLighting(lighting, width, height, x, y);

      product += (luminance[y * width + x] || 0) * expected;
      square += expected * expected;
    }
  }

  if (square <= 0) {
    return 0;
  }

  return product / square;
};

/**
 * Размах отклонений по перцентилю модуля. Копию сортируем, потому что порядок
 * значений карты трогать нельзя.
 */
const measureAmplitude = (values: Float32Array, percentile: number): number => {
  const magnitudes = new Float32Array(values.length);

  for (let index = 0; index < values.length; index += 1) {
    magnitudes[index] = Math.abs(values[index] || 0);
  }

  magnitudes.sort();

  return percentileOf(magnitudes, percentile);
};

/**
 * Шаг прореживания: заданный явно приводится к целому, иначе берётся из
 * предела длинной стороны карты. Сверху ограничен короткой стороной снимка —
 * прореживание крупнее самого листа оставило бы карту без единой точки.
 */
const resolveStep = (width: number, height: number, downscale?: number): number => {
  const requested =
    downscale === undefined
      ? Math.ceil(Math.max(width, height) / TEXTURE_MAP_MAX_SIZE)
      : Math.floor(downscale);

  return Math.max(1, Math.min(requested, Math.min(width, height)));
};

/**
 * Извлекает из фотографии листа высокочастотную карту текстуры бумаги:
 * яркость пикселя минус поле освещения, интерполированное в этой точке.
 * Функция чистая, DOM не трогает — кодированием карты в изображение занят
 * `encodeTextureMap`.
 *
 * Всё, что объясняется полем освещения, из карты вычитается: ровно освещённый
 * лист без зерна даёт нулевую карту и нулевой размах.
 *
 * @param image — полутоновая выжимка фотографии
 * @param lighting — поле освещения этой же фотографии
 * @param options — прореживание карты и перцентиль размаха
 * @returns карта отклонений и их размах; на вырожденном входе — карта 0×0
 */
export const extractTexture = (
  image: SheetImageData,
  lighting: LightingField,
  options?: ExtractTextureOptions
): TextureMap => {
  const { width, height, luminance } = image;
  const { downscale, amplitudePercentile = AMPLITUDE_PERCENTILE } = options || {};

  if (width <= 0 || height <= 0 || lighting.gridWidth === 0) {
    return { width: 0, height: 0, values: new Float32Array(0), amplitude: 0 };
  }

  const step = resolveStep(width, height, downscale);
  const mapWidth = Math.floor(width / step);
  const mapHeight = Math.floor(height / step);
  const level = fitLightingLevel(image, lighting, step);
  const values = new Float32Array(mapWidth * mapHeight);
  const blockSize = step * step;

  for (let row = 0; row < mapHeight; row += 1) {
    for (let column = 0; column < mapWidth; column += 1) {
      let sum = 0;

      for (let inner = 0; inner < blockSize; inner += 1) {
        const x = column * step + (inner % step);
        const y = row * step + Math.floor(inner / step);
        const expected = sampleLighting(lighting, width, height, x, y) * level;

        sum += (luminance[y * width + x] || 0) - expected;
      }

      values[row * mapWidth + column] = sum / blockSize;
    }
  }

  return {
    width: mapWidth,
    height: mapHeight,
    values,
    amplitude: measureAmplitude(values, amplitudePercentile),
  };
};
