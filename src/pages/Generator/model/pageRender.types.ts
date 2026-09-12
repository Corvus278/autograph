import type {
  BlockGeometry,
  GeometryCorrection,
  SheetCalibration,
} from '../lib/calibrate/calibrate.types';
import type { FontMetrics } from '../lib/measure/measure.types';
import type { Page } from '../lib/paginate/paginate.types';
import type { PaperFamily, PaperSheet, SheetRuling } from '../lib/paper/paper.types';
import type { DistortionFlags } from '../lib/randomize/randomize.types';
import type {
  InkModulationSource,
  PageGlyphs,
  PageRenderParams,
  RenderContext,
  RenderImage,
} from '../lib/render';

import type { GeneratorGeometryCorrection } from './generator.types';

/**
 * Всё, из чего складывается положение текста на листе: по чему считать
 * раскладку и что рисовать.
 */
export type PageGeometryView = {
  /**
   * Выбранная семья листов. `null` — семей нет вовсе.
   */
  family: PaperFamily | null;

  /**
   * Лист, доставшийся странице по рецепту прогона. `null` — семьи или листов
   * нет.
   */
  sheet: PaperSheet | null;

  /**
   * Разлиновка страницы в пикселях кадра её листа, на чётной странице —
   * отражённая. `null` — листа нет.
   */
  ruling: SheetRuling | null;

  /**
   * Метрики выбранного шрифта в долях кегля.
   */
  metrics: FontMetrics;

  /**
   * Геометрия блока в канонических пикселях семьи. `null` — семьи нет и
   * считать не по чему.
   *
   * @deprecated sheet-native-ruling — читать `sheetGeometry`
   */
  geometry: BlockGeometry | null;

  /**
   * Геометрия блока в пикселях кадра листа страницы. `null` — листа нет и
   * считать не по чему.
   */
  sheetGeometry: BlockGeometry | null;

  /**
   * Ручная поправка поверх вычисленной геометрии в долях шага разлиновки.
   */
  correction: GeneratorGeometryCorrection;

  /**
   * Семейство шрифта страницы: свой шрифт важнее выбора из списка.
   */
  fontFamily: string;
};

/**
 * Вход геометрии блока по канону семьи.
 *
 * @deprecated sheet-native-ruling — геометрия страницы считается по
 *   `SheetCalibration`
 */
export type CanonGeometryInput = {
  /**
   * Семья листов: по её канону выводится геометрия.
   */
  family: PaperFamily;

  /**
   * Метрики шрифта в долях кегля.
   */
  metrics: FontMetrics;

  /**
   * Ручная поправка поверх вычисленной геометрии в долях шага разлиновки.
   */
  correction: GeometryCorrection;
};

/**
 * Вход адаптера «стор и раскладка → параметры отрисовки». Поля перечислены
 * поимённо, а не взяты целым состоянием генератора: адаптер проверяется
 * юнит-тестом, и собирать ради него весь стор незачем.
 */
export type PageRenderInput = {
  /**
   * Страница с посчитанной раскладкой: строки уже разбиты по ширине блока.
   */
  page: Page;

  /**
   * Лист страницы в том виде, в каком по нему считается геометрия: разлиновка
   * страницы — на чётной странице уже отражённая — вместе с кадром листа. Кадр
   * задаёт размер страницы и прямоугольник фотографии, разлиновка — положение
   * и наклон блока текста.
   */
  calibration: SheetCalibration;

  /**
   * Фотография листа страницы, на чётной странице — отражённая. `null` — фон
   * скрыт или ещё не загружен: рисуются одни чернила.
   */
  sheetImage: RenderImage | null;

  /**
   * Метрики шрифта в долях кегля.
   */
  metrics: FontMetrics;

  /**
   * Ручная поправка поверх вычисленной геометрии в долях шага разлиновки.
   */
  correction: GeometryCorrection;

  /**
   * Цвет чернил в форме css-цвета.
   */
  inkColor: string;

  /**
   * Семейство шрифта страницы.
   */
  fontFamily: string;

  /**
   * Включённые виды искажений почерка.
   */
  flags: DistortionFlags;

  /**
   * Как часто слово попадает под побуквенные искажения.
   */
  wordFrequency: number;

  /**
   * Верхняя граница числа искажаемых букв в слове.
   */
  letterFrequency: number;

  /**
   * Seed искажений почерка.
   */
  seed: number;

  /**
   * Внешность выбранного экземпляра листа: ей подчиняются чернила.
   */
  ink: InkModulationSource;

  /**
   * Контуры шрифта страницы вместе с признаком вариативности. `null` —
   * контуров нет, текст рисуется шрифтом как есть.
   */
  glyphs: PageGlyphs | null;

  /**
   * Множитель разрешения отрисовки: 1 — пиксели кадра листа один в один.
   */
  scale: number;
};

/**
 * Всё, что нужно, чтобы отрисовать текущую страницу в любом разрешении.
 * Предпросмотр и сохранение берут параметры отсюда и отличаются только тем,
 * какой множитель разрешения просят: предпросмотр — вписывающий кадр в экран,
 * сохранение — единицу, кадр листа один к одному.
 */
export type PageRenderSource = {
  /**
   * Собирает параметры отрисовки в заданном разрешении.
   */
  buildParams: (scale: number) => PageRenderParams;

  /**
   * Ширина страницы — ширина кадра её листа в пикселях фотографии.
   */
  pageWidth: number;

  /**
   * Высота страницы — высота кадра её листа в пикселях фотографии.
   */
  pageHeight: number;

  /**
   * Множитель разрешения предпросмотра без учёта плотности экрана: вписывает
   * кадр листа в ширину листа на экране.
   */
  previewScale: number;

  /**
   * Качество кодирования JPEG от 0 до 1.
   */
  jpegQuality: number;
};

/**
 * Контекст рисования страницы: то же, чем пользуется рендерер, плюс заливка
 * прямоугольника. Заливка нужна снимку: формат с потерями не хранит
 * прозрачность, и незакрашенный лист вышел бы чёрным.
 */
export type PageDrawContext = RenderContext & {
  /**
   * Заливает прямоугольник текущим `fillStyle`.
   */
  fillRect(x: number, y: number, width: number, height: number): void;

  /**
   * Стирает прямоугольник до прозрачности.
   */
  clearRect(x: number, y: number, width: number, height: number): void;
};

/**
 * Поверхность, на которой растеризуется страница. Под неё подходит
 * `HTMLCanvasElement` целиком; тест подставляет запись вызовов.
 */
export type PageSurface = {
  /**
   * Ширина поверхности в пикселях.
   */
  width: number;

  /**
   * Высота поверхности в пикселях.
   */
  height: number;

  /**
   * Контекст рисования. `null` — браузер контекст не дал.
   */
  getContext: (contextId: '2d') => PageDrawContext | null;

  /**
   * Кодирует поверхность в data URL заданного типа.
   */
  toDataURL: (type: string, quality: number) => string;
};

/**
 * Создаёт поверхность нужного размера.
 */
export type CreatePageSurface = (width: number, height: number) => PageSurface;

/**
 * Поверхность для отражения фотографии: рисовать на ней и отдать результат
 * рендереру как изображение — разные роли одного и того же canvas.
 */
export type MirrorSurface = {
  /**
   * Контекст рисования. `null` — браузер контекст не дал.
   */
  context: PageDrawContext | null;

  /**
   * Сама поверхность как источник изображения.
   */
  image: RenderImage;
};

/**
 * Создаёт поверхность для отражения фотографии.
 */
export type CreateMirrorSurface = (width: number, height: number) => MirrorSurface;

/**
 * Вход растеризации страницы в файл.
 */
export type PageImageInput = {
  /**
   * Параметры отрисовки вместе с множителем разрешения.
   */
  params: PageRenderParams;

  /**
   * Ширина страницы — ширина кадра её листа.
   */
  pageWidth: number;

  /**
   * Высота страницы — высота кадра её листа.
   */
  pageHeight: number;

  /**
   * Качество кодирования от 0 до 1.
   */
  quality: number;

  /**
   * Чем создавать поверхность; в тестах подставляется запись вызовов.
   */
  createSurface?: CreatePageSurface;
};
