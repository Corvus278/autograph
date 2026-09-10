import type {
  FontMetrics,
  FontMetricsProbe,
  FontMetricsProbeFactory,
  FontsReadySource,
} from './measure.types';
import { waitForFont } from './waitForFont';

/**
 * Образец строчных без выносных элементов: подъём его чернил и есть высота
 * строчных. Несколько букв, а не одна: у рукописных шрифтов начертание
 * отдельной буквы гуляет, максимум по образцу устойчивее.
 */
const X_HEIGHT_SAMPLE = 'аеосхн';

/**
 * Кегль, на котором снимаются размеры. Крупный: доли считаются делением на
 * кегль, и на мелком округление до пикселя заметно сдвигает пропорцию.
 */
const PROBE_FONT_SIZE_PX = 200;

/**
 * Запасные метрики: усреднённые пропорции латиницы и кириллицы. Идут в дело,
 * когда щуп не создался (нет canvas, шрифт не загрузился) или намерил ноль —
 * геометрию всё равно нужно вывести, пусть и грубее.
 *
 * В кэш они не попадают: неудачный замер не должен залипнуть на всё время
 * жизни страницы, следующий вызов меряет заново.
 */
export const FALLBACK_FONT_METRICS: FontMetrics = {
  xHeight: 0.48,
  fontAscent: 0.9,
  lineHeight: 1.2,
};

/**
 * Метрики по семейству шрифта. Ключ — семейство: под одним именем в документе
 * живёт одно начертание, а пересъёмка метрик — это работа с настоящим
 * layout'ом, её не хочется делать на каждый пересчёт геометрии.
 */
const metricsCache = new Map<string, FontMetrics>();

/**
 * Щуп на canvas: `measureText` отдаёт и границы чернил фрагмента, и метрики
 * строчного бокса начертания, поэтому подъём снимается без вычитания отступов.
 *
 * @param fontFamily — семейство шрифта, метрики которого снимаются
 * @returns щуп или `null`, если 2d-контекст недоступен
 */
const createCanvasProbe: FontMetricsProbeFactory = (fontFamily) => {
  const context = document.createElement('canvas').getContext('2d');

  if (!context) {
    return null;
  }

  context.font = `${PROBE_FONT_SIZE_PX}px "${fontFamily}"`;

  const probe: FontMetricsProbe = {
    measureInkAscent: (sample) => {
      return context.measureText(sample).actualBoundingBoxAscent;
    },
    measureFontAscent: () => {
      return context.measureText(X_HEIGHT_SAMPLE).fontBoundingBoxAscent;
    },
    measureLineHeight: () => {
      const { fontBoundingBoxAscent, fontBoundingBoxDescent } =
        context.measureText(X_HEIGHT_SAMPLE);

      return fontBoundingBoxAscent + fontBoundingBoxDescent;
    },
    fontSizePx: PROBE_FONT_SIZE_PX,
  };

  return probe;
};

/**
 * Годен ли замер: ноль, отрицательное и `NaN` означают, что мерили не тем
 * шрифтом или не смогли измерить вовсе.
 *
 * @param measured — измеренная величина в пикселях
 * @returns можно ли считать по ней долю кегля
 */
const isMeasured = (measured: number): boolean => {
  return Number.isFinite(measured) && measured > 0;
};

/**
 * Снимает метрики шрифта и запоминает их. Повторный вызов на том же семействе
 * ничего не измеряет и отдаёт запомненное.
 *
 * Шрифт должен быть уже загружен: до загрузки браузер меряет подстановочным
 * начертанием. Неудачный замер отдаёт запасные метрики и **не** кэшируется —
 * следующий вызов, когда шрифт доедет, померяет заново.
 *
 * @param fontFamily — семейство шрифта
 * @param createProbe — фабрика щупа; в тестах подставляется модель
 * @returns доли кегля: высота строчных, подъём бокса, высота строки
 */
export const measureFontMetrics = (
  fontFamily: string,
  createProbe: FontMetricsProbeFactory = createCanvasProbe
): FontMetrics => {
  const cached = metricsCache.get(fontFamily);

  if (cached) {
    return cached;
  }

  const probe = createProbe(fontFamily);

  if (!probe) {
    return FALLBACK_FONT_METRICS;
  }

  const { fontSizePx } = probe;
  const xHeightPx = probe.measureInkAscent(X_HEIGHT_SAMPLE);
  const fontAscentPx = probe.measureFontAscent();
  const lineHeightPx = probe.measureLineHeight();
  const isProbeUsable =
    isMeasured(fontSizePx) &&
    isMeasured(xHeightPx) &&
    isMeasured(fontAscentPx) &&
    isMeasured(lineHeightPx);

  if (!isProbeUsable) {
    return FALLBACK_FONT_METRICS;
  }

  const metrics: FontMetrics = {
    xHeight: xHeightPx / fontSizePx,
    fontAscent: fontAscentPx / fontSizePx,
    lineHeight: lineHeightPx / fontSizePx,
  };

  metricsCache.set(fontFamily, metrics);

  return metrics;
};

/**
 * Дожидается шрифта и снимает метрики. Точка входа для приложения: замер до
 * загрузки уходит по подстановочному начертанию, а закэшировать его —
 * значит навсегда посадить текст мимо линий.
 *
 * @param fontFamily — семейство шрифта
 * @param createProbe — фабрика щупа; в тестах подставляется модель
 * @param fonts — источник шрифтов документа; в тестах подменяется
 * @returns метрики загруженного шрифта
 */
export const loadFontMetrics = async (
  fontFamily: string,
  createProbe: FontMetricsProbeFactory = createCanvasProbe,
  fonts: FontsReadySource | null = null
): Promise<FontMetrics> => {
  const cached = metricsCache.get(fontFamily);

  if (cached) {
    return cached;
  }

  /**
   * Кегль запроса на загрузку роли не играет — грузится начертание целиком.
   */
  const params = { fontFamily, fontSize: 1, lineSpacing: 0 };

  await waitForFont(params, fonts || document.fonts);

  return measureFontMetrics(fontFamily, createProbe);
};

/**
 * Сбрасывает запомненные метрики: нужен тестам и загрузке пользовательского
 * шрифта, когда под тем же именем семейства оказывается другое начертание.
 */
export const clearFontMetricsCache = (): void => {
  metricsCache.clear();
};
