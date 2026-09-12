import type { GeometryCorrection } from '../lib/calibrate/calibrate.types';
import type {
  DomMeasurer,
  FontMetrics,
  MeasurerParams,
} from '../lib/measure/measure.types';
import type { PaperFamily } from '../lib/paper/paper.types';

/**
 * Параметры, от которых зависит раскладка текста по страницам. Всё остальное —
 * цвет чернил, искажения, номер показанной страницы — на раскладку не влияет и
 * в ключ кэша не входит, поэтому меняется без повторного измерения.
 */
export type LayoutParams = {
  /**
   * Исходный текст.
   */
  text: string;

  /**
   * Семейство шрифта, которым набран текст.
   */
  fontFamily: string;

  /**
   * Метрики шрифта в долях кегля: по ним выводятся кегль, отступы и шаг строк
   * каждой страницы.
   */
  metrics: FontMetrics;

  /**
   * Ручная поправка геометрии в долях шага разлиновки.
   */
  correction: GeometryCorrection;

  /**
   * Запас снизу в долях шага разлиновки листа страницы.
   */
  bottomMargin: number;

  /**
   * Seed прогона: из него раздаются листы по страницам.
   */
  runSeed: number;

  /**
   * Выбранная семья вместе с подмешанными в неё своими листами.
   */
  family: PaperFamily;

  /**
   * Выбранный экземпляр листа. На раскладку влияет, только когда закреплён.
   */
  sheetId: string;

  /**
   * Экземпляр закреплён вручную и стоит на всех страницах прогона.
   */
  isSheetPinned: boolean;
};

/**
 * Как создать измеритель для этих параметров. Отдельным типом — чтобы тесты
 * подставляли модель вместо настоящего DOM.
 */
export type MeasurerFactory = (params: MeasurerParams) => DomMeasurer;
