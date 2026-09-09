/**
 * Переключатели искажений почерка. Каждый включается независимо; при всех
 * выключенных текст отрисовывается ровным набором.
 */
export type DistortionFlags = {
  /**
   * Случайный поворот слова.
   */
  isWordRotated: boolean;

  /**
   * Случайный наклон (скос) слова.
   */
  isWordSkewed: boolean;

  /**
   * Случайный вертикальный сдвиг слова.
   */
  isWordShifted: boolean;

  /**
   * Случайное расстояние между буквами внутри слова.
   */
  isLetterSpacingRandom: boolean;

  /**
   * Случайная подмена шрифта отдельных букв.
   */
  isLetterFontRandom: boolean;

  /**
   * Случайный поворот строки целиком — «съезд линий».
   */
  isLineRotated: boolean;

  /**
   * Случайный горизонтальный сдвиг строки целиком.
   */
  isLineShifted: boolean;
};

/**
 * Искажение одной буквы. Буквы, которых нет в списке, отрисовываются как весь
 * текст.
 */
export type LetterDistortion = {
  /**
   * Позиция буквы в слове.
   */
  index: number;

  /**
   * Добавка к расстоянию между буквами в пикселях. `null` — не менять.
   */
  letterSpacing: number | null;

  /**
   * Шрифт буквы. `null` — шрифт страницы.
   */
  fontFamily: string | null;
};

/**
 * Искажение одного слова: трансформации всего слова плюс список искажённых
 * букв.
 */
export type WordDistortion = {
  /**
   * Поворот слова в градусах.
   */
  rotate: number;

  /**
   * Скос слова в градусах.
   */
  skew: number;

  /**
   * Вертикальный сдвиг слова в пикселях.
   */
  translateY: number;

  /**
   * Искажённые буквы слова. Пустой массив — слово под побуквенную обработку не
   * попало.
   */
  letters: LetterDistortion[];
};

/**
 * Искажение строки целиком.
 */
export type LineDistortion = {
  /**
   * Поворот строки в градусах — «съезд линий».
   */
  rotate: number;

  /**
   * Горизонтальный сдвиг строки в пикселях.
   */
  translateX: number;
};

export type BuildDistortionsOptions = {
  /**
   * Включённые виды искажений.
   */
  flags: DistortionFlags;

  /**
   * Как часто слово попадает под побуквенную обработку: 1 — каждое подходящее,
   * дальше реже.
   */
  wordFrequency: number;

  /**
   * Верхняя граница числа искажаемых букв в слове.
   */
  letterFrequency: number;

  /**
   * Seed случайной последовательности: на одном seed рисунок почерка
   * повторяется.
   */
  seed: number;

  /**
   * Шрифты, на которые подменяются отдельные буквы.
   */
  substituteFonts: string[];
};

export type BuildLineDistortionsOptions = {
  /**
   * Включённые виды искажений; из них используются только построчные.
   */
  flags: DistortionFlags;

  /**
   * Seed случайной последовательности.
   */
  seed: number;
};
