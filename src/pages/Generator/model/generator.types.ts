import type { DistortionFlags } from '../lib/randomize/randomize.types';

/**
 * Параметры генератора — единственный источник правды о том, как выглядит
 * страница. DOM их только отображает.
 */
export type GeneratorState = {
  /**
   * Исходный текст. Переводы строк — границы абзацев.
   */
  text: string;

  /**
   * Выбранный встроенный шрифт.
   */
  fontFamily: string;

  /**
   * Семейство загруженного пользователем шрифта. `null` — свой шрифт не
   * загружен; пока не `null`, он важнее выбора из списка.
   */
  customFontFamily: string | null;

  /**
   * Цвет чернил для всего текста.
   */
  inkColor: string;

  /**
   * Размер шрифта в em.
   */
  fontSize: number;

  /**
   * Ширина блока текста в пикселях — по ней считается перенос.
   */
  blockWidth: number;

  /**
   * Добавка к межстрочному интервалу в пикселях; отрицательная сжимает строки.
   */
  lineSpacing: number;

  /**
   * Вертикальный сдвиг блока текста от верха листа в пикселях.
   */
  topOffset: number;

  /**
   * Левый отступ текста на нечётных страницах в пикселях.
   */
  leftPadding: number;

  /**
   * Левый отступ текста на чётных страницах — правой половине разворота.
   */
  evenPageLeftPadding: number;

  /**
   * Поворот всего блока текста в градусах; фон при этом не поворачивается.
   */
  blockRotate: number;

  /**
   * Высота нижнего поля в пикселях, которое остаётся незаполненным.
   */
  bottomMargin: number;

  /**
   * Идентификатор встроенного фона листа.
   */
  backgroundId: string;

  /**
   * Загруженный пользователем фон листа как data URL. `null` — используется
   * встроенный.
   */
  customBackgroundSrc: string | null;

  /**
   * Режим «убрать фон»: лист не рисуется, остаётся только текст.
   */
  isBackgroundHidden: boolean;

  /**
   * Включённые виды случайных искажений почерка.
   */
  flags: DistortionFlags;

  /**
   * Как часто слово попадает под побуквенные искажения: 1 — каждое подходящее.
   */
  wordFrequency: number;

  /**
   * Верхняя граница числа искажаемых букв в слове.
   */
  letterFrequency: number;

  /**
   * Режим композиции: снимок страницы вкладывается в сцену при сохранении.
   */
  isSceneEnabled: boolean;

  /**
   * Идентификатор встроенной сцены.
   */
  sceneId: string;

  /**
   * Загруженная пользователем сцена как data URL. `null` — используется
   * встроенная.
   */
  customSceneSrc: string | null;

  /**
   * Поворот страницы внутри сцены в градусах.
   */
  sceneRotate: number;

  /**
   * Сдвиг страницы внутри сцены по горизонтали в пикселях.
   */
  sceneShiftX: number;

  /**
   * Сдвиг страницы внутри сцены по вертикали в пикселях.
   */
  sceneShiftY: number;

  /**
   * Добавка к ширине вложенной страницы в пикселях: больше нуля — крупнее.
   */
  sceneScale: number;

  /**
   * Степень затемнения вложенной страницы, от 0 до 1.
   */
  sceneDarken: number;

  /**
   * Тень под вложенной страницей.
   */
  hasSceneShadow: boolean;

  /**
   * Номер открытой страницы, считая с нуля.
   */
  pageIndex: number;

  /**
   * Seed случайных искажений. Меняется при правке текста, переключении
   * искажений и по кнопке «Перегенерировать» — от него зависит рисунок
   * почерка.
   */
  seed: number;
};

/**
 * Стор генератора: параметры плюс методы их изменения. Методы — именно методы,
 * а не хендлеры: обработчики событий живут в компонентах и вызывают их.
 */
export type GeneratorStore = GeneratorState & {
  /**
   * Меняет исходный текст.
   */
  setText: (text: string) => void;

  /**
   * Выбирает встроенный шрифт.
   */
  setFontFamily: (fontFamily: string) => void;

  /**
   * Ставит или сбрасывает (`null`) загруженный пользователем шрифт.
   */
  setCustomFontFamily: (fontFamily: string | null) => void;

  /**
   * Меняет цвет чернил.
   */
  setInkColor: (inkColor: string) => void;

  /**
   * Меняет числовой параметр геометрии блока текста.
   */
  setGeometry: (patch: Partial<GeneratorGeometry>) => void;

  /**
   * Выбирает встроенный фон листа и сбрасывает загруженный.
   */
  selectBackground: (backgroundId: string) => void;

  /**
   * Ставит или сбрасывает (`null`) загруженный фон листа.
   */
  setCustomBackground: (src: string | null) => void;

  /**
   * Включает или выключает режим «убрать фон».
   */
  setBackgroundHidden: (isHidden: boolean) => void;

  /**
   * Переключает один вид искажений.
   */
  toggleDistortion: (flag: keyof DistortionFlags) => void;

  /**
   * Меняет частоту побуквенной обработки слов.
   */
  setWordFrequency: (wordFrequency: number) => void;

  /**
   * Меняет ограничение на число искажаемых букв.
   */
  setLetterFrequency: (letterFrequency: number) => void;

  /**
   * Пересчитывает случайные искажения, не трогая остальные параметры.
   */
  regenerate: () => void;

  /**
   * Включает или выключает режим композиции со сценой.
   */
  setSceneEnabled: (isEnabled: boolean) => void;

  /**
   * Выбирает встроенную сцену и сбрасывает загруженную.
   */
  selectScene: (sceneId: string) => void;

  /**
   * Ставит или сбрасывает (`null`) загруженную сцену.
   */
  setCustomScene: (src: string | null) => void;

  /**
   * Меняет параметры вложения страницы в сцену.
   */
  setSceneParams: (patch: Partial<GeneratorSceneParams>) => void;

  /**
   * Открывает страницу с указанным номером.
   */
  goToPage: (pageIndex: number) => void;

  /**
   * Приводит номер открытой страницы к допустимому диапазону после пересчёта
   * разбивки.
   */
  clampPageIndex: (pageCount: number) => void;
};

/**
 * Числовые параметры геометрии блока текста — те, что меняются слайдерами.
 */
export type GeneratorGeometry = Pick<
  GeneratorState,
  | 'fontSize'
  | 'blockWidth'
  | 'lineSpacing'
  | 'topOffset'
  | 'leftPadding'
  | 'evenPageLeftPadding'
  | 'blockRotate'
  | 'bottomMargin'
>;

/**
 * Параметры вложения страницы в сцену.
 */
export type GeneratorSceneParams = Pick<
  GeneratorState,
  | 'sceneRotate'
  | 'sceneShiftX'
  | 'sceneShiftY'
  | 'sceneScale'
  | 'sceneDarken'
  | 'hasSceneShadow'
>;
