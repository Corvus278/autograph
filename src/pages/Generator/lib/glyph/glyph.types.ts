/**
 * Точка пути глифа в единицах шрифта.
 */
export type GlyphPoint = {
  /**
   * Координата по горизонтали.
   */
  x: number;

  /**
   * Координата по вертикали. Ось направлена вверх: так контуры отдаёт шрифт.
   */
  y: number;
};

/**
 * Перевод пера без рисования: начало нового контура.
 */
export type GlyphMoveCommand = GlyphPoint & {
  /**
   * Тип команды.
   */
  type: 'M';
};

/**
 * Отрезок прямой до точки команды.
 */
export type GlyphLineCommand = GlyphPoint & {
  /**
   * Тип команды.
   */
  type: 'L';
};

/**
 * Квадратичная кривая: одна контрольная точка и конец.
 */
export type GlyphQuadCommand = GlyphPoint & {
  /**
   * Тип команды.
   */
  type: 'Q';

  /**
   * Горизонталь контрольной точки.
   */
  x1: number;

  /**
   * Вертикаль контрольной точки.
   */
  y1: number;
};

/**
 * Кубическая кривая: две контрольные точки и конец.
 */
export type GlyphCubicCommand = GlyphPoint & {
  /**
   * Тип команды.
   */
  type: 'C';

  /**
   * Горизонталь первой контрольной точки.
   */
  x1: number;

  /**
   * Вертикаль первой контрольной точки.
   */
  y1: number;

  /**
   * Горизонталь второй контрольной точки.
   */
  x2: number;

  /**
   * Вертикаль второй контрольной точки.
   */
  y2: number;
};

/**
 * Замыкание контура.
 */
export type GlyphCloseCommand = {
  /**
   * Тип команды.
   */
  type: 'Z';
};

/**
 * Команда пути глифа в единицах шрифта.
 */
export type GlyphPathCommand =
  | GlyphMoveCommand
  | GlyphLineCommand
  | GlyphQuadCommand
  | GlyphCubicCommand
  | GlyphCloseCommand;

/**
 * Прямоугольник, охватывающий точки пути, в единицах шрифта.
 */
export type GlyphBounds = {
  /**
   * Левая граница.
   */
  minX: number;

  /**
   * Правая граница.
   */
  maxX: number;

  /**
   * Нижняя граница.
   */
  minY: number;

  /**
   * Верхняя граница.
   */
  maxY: number;
};

/**
 * Разделение контуров глифа на тело буквы и диакритику.
 */
export type ContourClassification = {
  /**
   * Индексы контуров тела буквы в исходном порядке.
   */
  bodyIndexes: number[];

  /**
   * Индексы контуров диакритики: они не пересекаются с телом по вертикали.
   */
  markIndexes: number[];

  /**
   * Габариты каждого контура — по индексу исходного контура.
   */
  bounds: GlyphBounds[];

  /**
   * Габариты чернил тела буквы: объединение габаритов контуров тела.
   */
  bodyBox: GlyphBounds;
};

/**
 * Параметры деформации контуров одного экземпляра буквы.
 */
export type DeformGlyphOptions = {
  /**
   * Единиц шрифта на em: все доли ниже считаются от него.
   */
  unitsPerEm: number;

  /**
   * Продвижение глифа в единицах шрифта: по нему находятся стыки с соседними
   * буквами.
   */
  advanceWidth: number;

  /**
   * Seed экземпляра буквы. Одинаковый seed даёт одинаковый контур.
   */
  seed: number;

  /**
   * Амплитуда смещения точки в долях em.
   */
  amplitude?: number;

  /**
   * Размер ячейки решётки шума в долях em.
   */
  cell?: number;

  /**
   * Ширина рампы гашения у границ продвижения глифа в долях em.
   */
  seamRamp?: number;
};

/**
 * Контуры одного глифа в единицах шрифта.
 */
export type GlyphOutline = {
  /**
   * Символ, которому соответствует глиф.
   */
  char: string;

  /**
   * Команды пути в единицах шрифта.
   */
  commands: GlyphPathCommand[];

  /**
   * Продвижение пера после глифа в единицах шрифта.
   */
  advanceWidth: number;
};

/**
 * Источник контуров одного шрифта.
 */
export type GlyphSource = {
  /**
   * Единиц шрифта на em.
   */
  unitsPerEm: number;

  /**
   * Контуры глифа символа. `null` — в шрифте такого символа нет.
   */
  getGlyph: (char: string) => GlyphOutline | null;

  /**
   * Кернинг пары символов в единицах шрифта. Ноль — пары в шрифте нет либо
   * хотя бы одного из символов шрифт не знает: кернинг заглушки `.notdef`
   * ничего не значит.
   */
  getKerning: (leftChar: string, rightChar: string) => number;
};
