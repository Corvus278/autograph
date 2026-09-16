import type {
  ExtractLightingOptions,
  LightingField,
  LightingGrid,
  SheetImageData,
} from './paper.types';
import { isInsideSheetOutline } from './sheetOutlineMask';

/**
 * Число клеток сетки вдоль длинной стороны листа. Шестнадцать — компромисс
 * между двумя крайностями: на более крупной сетке пропадает виньетка по краям
 * кадра, на более мелкой в поле начинает просачиваться разлиновка и зерно
 * бумаги, а поле обязано остаться низкочастотным — высокие частоты снимает
 * `extractTexture`.
 */
const LIGHTING_GRID_SIZE = 16;

/**
 * Перцентили, по которым берётся размах яркости. Крайние значения не годятся:
 * тень от пальца или пятно на пару клеток из двух сотен растягивают размах
 * так же, как настоящий боковой свет, и плоский скан с одной кляксой прошёл
 * бы за фотографию. Пять процентов клеток с каждого края — это заведомо
 * больше любого локального дефекта и заведомо меньше целого края листа, на
 * котором свет и падает.
 */
const CONTRAST_LOW_PERCENTILE = 0.05;
const CONTRAST_HIGH_PERCENTILE = 0.95;

/**
 * Порог размаха яркости, ниже которого поле считается непригодным. Скан и
 * фотография различаются на порядок: у планшетного сканера и у равномерной
 * заливки размах держится в пределах пары процентов, у снятого телефоном
 * листа — десятки. На пресет-паке `public/paper/*.jpg` полный кадр даёт
 * 0.242…0.338, то есть запас к порогу четырёхкратный.
 *
 * Два условия, при которых порог верен:
 *
 * поле снимается с полного кадра листа. У центрального кропа в половину кадра
 * тот же пак даёт 0.021…0.093, и половина снимков уходит под порог: свет
 * падает к краям листа, а в середине он почти ровный.
 *
 * порог сравнивается с измеренным размахом, а он занижен примерно на семь
 * процентов: узлы сетки сидят в центрах клеток и не достают до самых краёв
 * листа. Истинный линейный градиент проходит, начиная примерно с 0.065.
 */
export const LIGHTING_USABLE_CONTRAST = 0.06;

/**
 * Значение перцентиля в отсортированном ряду с линейной интерполяцией между
 * соседями. Позиция считается от `length - 1`, а не от `length`: иначе на
 * коротком ряду любой высокий перцентиль вырождается в максимум и перестаёт
 * отсекать выбросы, ради которых его и берут.
 *
 * @param sorted — ряд, отсортированный по возрастанию
 * @param percentile — доля от нуля до единицы
 * @returns значение перцентиля; ноль на пустом ряду
 */
export const percentileOf = (sorted: Float32Array, percentile: number): number => {
  const size = sorted.length;

  if (size === 0) {
    return 0;
  }

  const position = Math.min(1, Math.max(0, percentile)) * (size - 1);
  const lower = Math.floor(position);
  const upper = Math.min(lower + 1, size - 1);
  const weight = position - lower;

  return (sorted[lower] || 0) * (1 - weight) + (sorted[upper] || 0) * weight;
};

/**
 * Считает размер сетки для листа: длинная сторона получает `gridSize` клеток,
 * короткая — пропорционально своей длине. Клетки выходят почти квадратными, и
 * поле сглаживается одинаково по обеим осям — иначе на вытянутом листе свет
 * вдоль короткой стороны размывался бы сильнее, чем вдоль длинной.
 *
 * @param width — ширина изображения в пикселях
 * @param height — высота изображения в пикселях
 * @param gridSize — число клеток вдоль длинной стороны
 * @returns размер сетки; нули на вырожденном изображении
 */
export const resolveLightingGrid = (
  width: number,
  height: number,
  gridSize: number = LIGHTING_GRID_SIZE
): LightingGrid => {
  if (width <= 0 || height <= 0 || gridSize <= 0) {
    return { gridWidth: 0, gridHeight: 0 };
  }

  const longSide = Math.max(width, height);
  const columns = Math.max(1, Math.round((width / longSide) * gridSize));
  const rows = Math.max(1, Math.round((height / longSide) * gridSize));

  return {
    gridWidth: Math.min(width, columns),
    gridHeight: Math.min(height, rows),
  };
};

/**
 * Медиана первых `count` значений буфера. Буфер сортируется на месте: он
 * рабочий и переиспользуется между клетками, чтобы не выделять массив на
 * каждую из двух сотен.
 */
const medianOf = (buffer: Float32Array, count: number): number => {
  if (count <= 0) {
    return 0;
  }

  const sorted = buffer.subarray(0, count).sort();
  const middle = count >> 1;
  const upper = sorted[middle] || 0;

  if (count % 2 === 1) {
    return upper;
  }

  return (upper + (sorted[middle - 1] || 0)) / 2;
};

/**
 * Какая доля точек клетки обязана лежать внутри контура, чтобы клетка считалась
 * снятой с бумаги. У клетки, наполовину легшей на стол, медиана — это уже не
 * яркость бумаги, а середина между бумагой и столом.
 */
const MIN_CELL_PAPER_SHARE = 0.5;

/**
 * Яркости клеток, снятых с бумаги, по возрастанию. По ним и только по ним
 * считаются нормировка и размах: клетка со столом занизила бы и то и другое.
 *
 * @param cells — яркости всех клеток сетки
 * @param paperMask — единица у клеток с бумагой
 * @returns отсортированные яркости клеток с бумагой
 */
const collectPaperCells = (cells: Float32Array, paperMask: Uint8Array): Float32Array => {
  const values = new Float32Array(cells.length);

  let count = 0;

  for (let index = 0; index < cells.length; index += 1) {
    if (paperMask[index] === 1) {
      values[count] = cells[index] || 0;
      count += 1;
    }
  }

  return values.subarray(0, count).sort();
};

/**
 * Раздаёт клеткам без бумаги яркость ближайшей клетки с бумагой, при равном
 * расстоянии — среднее таких клеток. Поле остаётся низкочастотным и за краем
 * листа: шейдер выбирает его по координатам страницы, и провал на месте стола
 * проступил бы тенью на самих чернилах.
 *
 * @param cells — яркости клеток сетки; меняются на месте
 * @param paperMask — единица у клеток с бумагой
 * @param gridWidth — число столбцов сетки
 * @param gridHeight — число строк сетки
 */
const fillOutsideCells = (
  cells: Float32Array,
  paperMask: Uint8Array,
  gridWidth: number,
  gridHeight: number
): void => {
  for (let row = 0; row < gridHeight; row += 1) {
    for (let column = 0; column < gridWidth; column += 1) {
      const index = row * gridWidth + column;

      if (paperMask[index] === 0) {
        let nearest = Number.POSITIVE_INFINITY;
        let sum = 0;
        let count = 0;

        for (let otherRow = 0; otherRow < gridHeight; otherRow += 1) {
          for (let otherColumn = 0; otherColumn < gridWidth; otherColumn += 1) {
            const otherIndex = otherRow * gridWidth + otherColumn;

            if (paperMask[otherIndex] === 1) {
              const distance = (otherRow - row) ** 2 + (otherColumn - column) ** 2;

              if (distance < nearest) {
                nearest = distance;
                sum = cells[otherIndex] || 0;
                count = 1;
              } else if (distance === nearest) {
                sum += cells[otherIndex] || 0;
                count += 1;
              }
            }
          }
        }

        cells[index] = count > 0 ? sum / count : 0;
      }
    }
  }
};

/**
 * Извлекает из фотографии пустого листа низкочастотное поле освещения.
 *
 * Яркость клетки берётся медианой, а не средним: разлиновка и соринки — это
 * тёмный хвост распределения, который тянет среднее вниз тем сильнее, чем
 * гуще линии, тогда как медиана остаётся яркостью самой бумаги.
 *
 * Поле нормируется на самый светлый узел, `contrast` — доля, на которую
 * тёмная часть листа темнее светлой. Равномерно освещённый источник даёт
 * `isUsable: false`: отрисовке в этом случае нужно синтетическое освещение.
 *
 * @param image — полутоновая выжимка фотографии полного кадра листа
 * @param options — размер сетки и порог пригодности
 * @returns поле освещения; на вырожденном изображении — пустое и непригодное
 */
export const extractLighting = (
  image: SheetImageData,
  options?: ExtractLightingOptions
): LightingField => {
  const { width, height, luminance } = image;
  const {
    gridSize,
    usableContrast = LIGHTING_USABLE_CONTRAST,
    outline = null,
  } = options || {};
  const { gridWidth, gridHeight } = resolveLightingGrid(width, height, gridSize);

  if (gridWidth === 0 || gridHeight === 0) {
    return {
      gridWidth: 0,
      gridHeight: 0,
      values: [],
      contrast: 0,
      isUsable: false,
    };
  }

  const cellWidth = Math.ceil(width / gridWidth) + 1;
  const cellHeight = Math.ceil(height / gridHeight) + 1;
  const buffer = new Float32Array(cellWidth * cellHeight);
  const cells = new Float32Array(gridWidth * gridHeight);
  const paperMask = new Uint8Array(gridWidth * gridHeight);

  for (let row = 0; row < gridHeight; row += 1) {
    const top = Math.floor((row * height) / gridHeight);
    const bottom = Math.floor(((row + 1) * height) / gridHeight);

    for (let column = 0; column < gridWidth; column += 1) {
      const left = Math.floor((column * width) / gridWidth);
      const right = Math.floor(((column + 1) * width) / gridWidth);
      const index = row * gridWidth + column;

      let count = 0;
      let total = 0;

      for (let y = top; y < bottom; y += 1) {
        for (let x = left; x < right; x += 1) {
          total += 1;

          if (outline === null || isInsideSheetOutline(outline, x, y)) {
            buffer[count] = luminance[y * width + x] || 0;
            count += 1;
          }
        }
      }

      paperMask[index] = count > 0 && count >= total * MIN_CELL_PAPER_SHARE ? 1 : 0;
      cells[index] = paperMask[index] === 1 ? medianOf(buffer, count) : 0;
    }
  }

  const sorted = collectPaperCells(cells, paperMask);
  const brightest = sorted[sorted.length - 1] || 0;

  fillOutsideCells(cells, paperMask, gridWidth, gridHeight);

  if (brightest <= 0) {
    return {
      gridWidth,
      gridHeight,
      values: Array.from(cells, () => {
        return 0;
      }),
      contrast: 0,
      isUsable: false,
    };
  }

  const high = percentileOf(sorted, CONTRAST_HIGH_PERCENTILE);
  const low = percentileOf(sorted, CONTRAST_LOW_PERCENTILE);
  const contrast = high > 0 ? 1 - low / high : 0;

  return {
    gridWidth,
    gridHeight,
    values: Array.from(cells, (cell) => {
      return cell / brightest;
    }),
    contrast,
    isUsable: contrast >= usableContrast,
  };
};
