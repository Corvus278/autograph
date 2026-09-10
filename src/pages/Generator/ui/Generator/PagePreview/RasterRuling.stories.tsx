import type { Meta, StoryObj } from '@storybook/react-vite';
import type { FC } from 'react';
import { useEffect } from 'react';
import { expect, waitFor } from 'storybook/test';
import { useShallow } from 'zustand/react/shallow';

import { GRID_FAMILY_ID, HANDWRITING_FONTS, LINED_FAMILY_ID } from '../../../config';
import { GRID_ROW_STEPS } from '../../../lib/calibrate/deriveGeometry';
import { loadFontMetrics } from '../../../lib/measure/measureFontMetrics';
import type { PaperFamily } from '../../../lib/paper';
import type { PageRenderParams, RenderImage } from '../../../lib/render';
import { loadRenderImage } from '../../../lib/render';
import { drawPage, measurePageImage } from '../../../model/drawPage';
import { clearLayoutCache } from '../../../model/measureLayout';
import { mirrorRenderImage } from '../../../model/mirrorRenderImage';
import { loadPaperFamilies } from '../../../model/paperProfiles';
import { findSheet } from '../../../model/paperSelectors';
import {
  DEFAULT_GENERATOR_STATE,
  useGeneratorStore,
} from '../../../model/useGeneratorStore';
import { usePageGeometry } from '../../../model/usePageGeometry';
import { usePageLayout } from '../../../model/usePageLayout';
import { usePageRender } from '../../../model/usePageRender';

/**
 * Что нужно, чтобы нарисовать страницу и померить её растр. Параметры берутся
 * те же самые, которыми рисует генератор: проверка идёт по пикселям готовой
 * страницы, а не по числам, из которых она собрана.
 */
type RasterProbe = {
  /**
   * Экземпляр листа, чья фотография ушла в отрисовку.
   */
  sheetId: string;

  /**
   * Номер показанной страницы: у соседних половин разворота параметры разные,
   * а экземпляр один и тот же.
   */
  pageIndex: number;

  /**
   * Параметры отрисовки страницы в канонических пикселях семьи.
   */
  params: PageRenderParams;

  /**
   * Семья листов: её канон — то, с чем сверяется разлиновка на растре.
   */
  family: PaperFamily;
};

/**
 * Полутоновая выжимка нарисованной страницы.
 */
type PageRaster = {
  /**
   * Ширина растра в пикселях.
   */
  width: number;

  /**
   * Высота растра в пикселях.
   */
  height: number;

  /**
   * Яркости пикселей от 0 до 1, построчно сверху вниз.
   */
  luminance: Float32Array;
};

/**
 * Участок растра, по которому снимается профиль.
 */
type RasterBand = {
  /**
   * Левый столбец участка включительно.
   */
  left: number;

  /**
   * Правый столбец участка не включая.
   */
  right: number;

  /**
   * Верхняя строка участка включительно.
   */
  top: number;

  /**
   * Нижняя строка участка не включая.
   */
  bottom: number;
};

/**
 * Профиль яркости вдоль наклонных линий вместе с местом его первого отсчёта.
 */
type ShearedProfile = {
  /**
   * Средние яркости бинов сверху вниз.
   */
  values: Float64Array;

  /**
   * Строка растра, которой отвечает нулевой бин, считая от верха участка.
   */
  origin: number;
};

/**
 * Найденная на растре разлиновка: шаг и положение линий вдоль их наклона.
 */
type RasterRuling = {
  /**
   * Тангенс наклона линий: снят свипом по растру, а не взят из характеристик
   * экземпляра.
   */
  tangent: number;

  /**
   * Строка участка, которой отвечает нулевой бин профиля.
   */
  origin: number;

  /**
   * Шаг разлиновки в пикселях растра.
   */
  period: number;

  /**
   * Положение линии в бинах профиля по модулю шага.
   */
  phase: number;

  /**
   * Глубина гребёнки в долях яркости: по ней видно, что найден именно ряд
   * линий, а не шум.
   */
  contrast: number;
};

/**
 * Веса каналов при переводе цвета в яркость — та же свёртка, что и у разбора
 * фотографий листа.
 */
const RED_WEIGHT = 0.2126;
const GREEN_WEIGHT = 0.7152;
const BLUE_WEIGHT = 0.0722;

/**
 * Окно, по которому из профиля вычитается фон. Шире любого шага разлиновки и
 * заметно уже неравномерности освещения листа: свет уходит, линии остаются.
 */
const BACKGROUND_WINDOW = 151;

/**
 * Границы перебора шага разлиновки в пикселях растра. Канонические шаги семей
 * лежат внутри с запасом в обе стороны, поэтому неверный масштаб фотографии
 * не выпадает из перебора, а находится с неправильным шагом — это и нужно
 * увидеть.
 */
const MIN_PERIOD = 20;
const MAX_PERIOD = 160;

/**
 * Доля от лучшего отклика, начиная с которой сдвиг считается основным
 * периодом: у гребёнки отклик повторяется на кратных сдвигах, а нужен первый.
 */
const FUNDAMENTAL_SHARE = 0.7;

/**
 * Границы и шаг свипа наклона. Наклон разлиновки в пресет-паке не выходит за
 * два градуса, перебор берётся с запасом.
 */
const MAX_TANGENT = 0.06;
const TANGENT_STEP = 0.004;

/**
 * Допустимое отклонение базовой линии от линии разлиновки в долях шага —
 * ровно то, что требует сценарий «Строки ложатся на линии».
 */
const DRIFT_TOLERANCE = 0.1;

/**
 * Допустимое расхождение измеренного шага с каноном семьи в долях шага.
 * Растровый замер грубее расчёта: линия занимает несколько пикселей, и
 * положение её середины гуляет на доли пикселя.
 */
const PERIOD_TOLERANCE = 0.02;

/**
 * Допустимое расхождение измеренного наклона с наклоном экземпляра в
 * градусах.
 */
const ANGLE_TOLERANCE = 0.5;

/**
 * Наименьшая глубина гребёнки, при которой замеру можно верить.
 */
const MIN_CONTRAST = 0.004;

/**
 * Сколько шагов разлиновки должно уместиться в полосе без чернил и сколько их
 * берётся в замер. Больше десятка шагов период не уточняют, а каждый лишний
 * пиксель полосы проходится свипом наклона по разу.
 */
const MIN_BAND_STEPS = 4;
const MAX_BAND_STEPS = 12;

/**
 * Через сколько столбцов берётся отсчёт в профиле. Линии разлиновки тянутся
 * через весь кадр, и каждый третий столбец описывает их не хуже сплошного
 * прохода — а свип наклона идёт втрое быстрее.
 */
const COLUMN_STRIDE = 3;

/**
 * Яркость, ниже которой пиксель считается чернилами. Бумага и разлиновка
 * заметно светлее: линия печатается бледной, чернила — тёмные.
 */
const INK_LEVEL = 0.45;

/**
 * Доли от вершины строки: по первой строка отделяется от пустого места, по
 * второй ищется её низ. Низ строки — не низ чернил: выносные элементы уходят
 * под базовую линию, но их на порядок меньше, чем тела букв.
 */
const INK_BAND_SHARE = 0.15;
const INK_BASELINE_SHARE = 0.35;

/**
 * Допустимое расхождение низа строки чернил с расчётной базовой линией в долях
 * шага. Замер грубее расчёта: край чернил размыт сглаживанием, а под линией
 * остаются выносные элементы. На пресет-паке расхождение не выходит за
 * четыре сотых шага, поэтому запас взят с тройным перекрытием — но постоянный
 * сдвиг в четверть шага, какой даёт сверка по серединам строк, порог ловит.
 */
const INK_TOLERANCE = 0.15;

/**
 * Доли ширины фотографии, между которыми снимается профиль. Края отброшены
 * намеренно: у листа в клетку за линией поля напечатана мелкая линейка со
 * своим шагом, и на отражённой странице она оказывается у другого края.
 */
const BAND_LEFT_SHARE = 0.3;
const BAND_RIGHT_SHARE = 0.7;

/**
 * Текст на несколько строк: строк должно хватить, чтобы расхождение шага
 * успело накопиться, и при этом низ страницы обязан остаться чистым — по нему
 * меряется разлиновка.
 */
const TEXT = [
  'Рукописные строки садятся на разлиновку тетрадного листа,',
  'и низ страницы остаётся чистым, чтобы линии было по чему померить.',
].join(' ');

/**
 * Шрифт проверки: тот, с которым генератор открывается.
 */
const DEFAULT_FONT = HANDWRITING_FONTS[0]?.family || '';

let lastProbe: RasterProbe | null = null;

/**
 * Проба страницы: собирает параметры отрисовки теми же хуками, что и экран
 * генератора.
 */
const RasterRulingProbe: FC = () => {
  const pages = usePageLayout();
  const source = usePageRender(pages);
  const { family } = usePageGeometry();
  const { sheetId, pageIndex } = useGeneratorStore(
    useShallow((state) => {
      return { sheetId: state.sheetId, pageIndex: state.pageIndex };
    })
  );
  const params = source ? source.buildParams(1) : null;
  const sheet = family ? findSheet(family, sheetId) : undefined;
  const probe: RasterProbe | null =
    family && sheet && params?.background
      ? { sheetId: sheet.id, pageIndex, params, family }
      : null;

  /**
   * Без списка зависимостей: фотография листа и метрики шрифта доезжают
   * асинхронно, и проверке важно последнее состояние.
   */
  useEffect(() => {
    lastProbe = probe;
  });

  return (
    <p data-testid="raster-probe">
      {probe
        ? `${probe.sheetId}: строк ${probe.params.page.lines.length}`
        : 'страница не собралась'}
    </p>
  );
};

/**
 * Рисует страницу настоящим путём отрисовки и снимает с неё полутоновую
 * выжимку.
 *
 * Фотография подставляется своя, а не та, что держит хук предпросмотра: хук
 * оставляет прежнюю картинку, пока грузится новая, и проверка успевала бы
 * снять чужой лист с новой укладкой. Всё остальное — укладка, геометрия,
 * искажения — приходит из настоящего пути отрисовки.
 *
 * @param probe — проба страницы
 * @param image — фотография выбранного экземпляра
 * @returns растр страницы
 */
const renderProbeRaster = (probe: RasterProbe, image: RenderImage): PageRaster => {
  const { family } = probe;
  const params: PageRenderParams = {
    ...probe.params,
    background: probe.params.background ? { ...probe.params.background, image } : null,
  };
  const size = measurePageImage(family.width, family.height, params.scale);
  const canvas = document.createElement('canvas');

  canvas.width = size.width;
  canvas.height = size.height;

  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Браузер не дал контекст canvas');
  }

  drawPage(context, params, size);

  const { data } = context.getImageData(0, 0, size.width, size.height);
  const luminance = new Float32Array(size.width * size.height);

  for (let index = 0; index < luminance.length; index += 1) {
    const offset = index * 4;

    luminance[index] =
      ((data[offset] || 0) * RED_WEIGHT +
        (data[offset + 1] || 0) * GREEN_WEIGHT +
        (data[offset + 2] || 0) * BLUE_WEIGHT) /
      255;
  }

  return { width: size.width, height: size.height, luminance };
};

/**
 * Профиль средней яркости вдоль линий, наклонённых на заданный тангенс. Бин
 * профиля отвечает строке растра в левом столбце участка: наклон учитывается
 * сдвигом, а не поворотом растра.
 *
 * Края, где бин собрался не со всей ширины участка, отброшены — иначе
 * профили разных наклонов стали бы несравнимы.
 *
 * @param raster — растр страницы
 * @param band — участок растра
 * @param tangent — тангенс наклона линий
 * @returns средние яркости бинов сверху вниз
 */
const buildProfile = (
  raster: PageRaster,
  band: RasterBand,
  tangent: number
): ShearedProfile => {
  const height = band.bottom - band.top;
  const sums = new Float64Array(height);
  const counts = new Float64Array(height);

  for (let x = band.left; x < band.right; x += COLUMN_STRIDE) {
    const shift = Math.round((x - band.left) * tangent);

    for (let y = band.top; y < band.bottom; y += 1) {
      const bin = y - band.top - shift;

      if (bin >= 0 && bin < height) {
        sums[bin] = (sums[bin] || 0) + (raster.luminance[y * raster.width + x] || 0);
        counts[bin] = (counts[bin] || 0) + 1;
      }
    }
  }

  /**
   * Края отрезаются, а не обнуляются: бин, собранный не со всей ширины
   * участка, темнее соседей на ровном месте, и такой скачок перебил бы в
   * автокорреляции саму разлиновку.
   */
  const guard = Math.ceil(Math.abs(tangent) * (band.right - band.left)) + 1;
  const size = Math.max(0, height - 2 * guard);
  const values = new Float64Array(size);

  for (let index = 0; index < size; index += 1) {
    const bin = index + guard;
    const count = counts[bin] || 0;

    values[index] = count > 0 ? (sums[bin] || 0) / count : 0;
  }

  return { values, origin: guard };
};

/**
 * Затемнение профиля относительно местного фона: положительное на линиях.
 * Заодно уходит неравномерность освещения листа.
 *
 * @param profile — профиль яркости
 * @returns ряд затемнений
 */
const buildDarkness = (profile: Float64Array): Float64Array => {
  const size = profile.length;
  const half = Math.floor(BACKGROUND_WINDOW / 2);
  const prefix = new Float64Array(size + 1);
  const darkness = new Float64Array(size);

  for (let index = 0; index < size; index += 1) {
    prefix[index + 1] = (prefix[index] || 0) + (profile[index] || 0);
  }

  for (let index = 0; index < size; index += 1) {
    const from = Math.max(0, index - half);
    const to = Math.min(size, index + half + 1);
    const background = ((prefix[to] || 0) - (prefix[from] || 0)) / (to - from);

    darkness[index] = background - (profile[index] || 0);
  }

  return darkness;
};

/**
 * Размах ряда: по нему выбирается наклон, при котором линии не размазаны.
 */
const measureSpread = (values: Float64Array): number => {
  let sum = 0;

  for (let index = 0; index < values.length; index += 1) {
    sum += (values[index] || 0) ** 2;
  }

  return values.length > 0 ? Math.sqrt(sum / values.length) : 0;
};

/**
 * Отклик автокорреляции затемнений на заданном сдвиге.
 */
const measureResponse = (darkness: Float64Array, lag: number): number => {
  let sum = 0;

  for (let index = 0; index + lag < darkness.length; index += 1) {
    sum += (darkness[index] || 0) * (darkness[index + lag] || 0);
  }

  return darkness.length > lag ? sum / (darkness.length - lag) : 0;
};

/**
 * Шаг разлиновки по автокорреляции затемнений.
 *
 * Берётся первый сдвиг, отклик на котором сравним с лучшим: у ряда линий
 * отклик повторяется на кратных сдвигах, а нужен основной период. Вершина
 * уточняется параболой по трём соседним откликам.
 *
 * @param darkness — ряд затемнений
 * @returns шаг в пикселях растра; ноль — периодичности нет
 */
const measurePeriod = (darkness: Float64Array): number => {
  const responses = new Float64Array(MAX_PERIOD + 1);
  let best = 0;

  for (let lag = MIN_PERIOD; lag <= MAX_PERIOD; lag += 1) {
    responses[lag] = measureResponse(darkness, lag);
    best = Math.max(best, responses[lag] || 0);
  }

  if (best <= 0) {
    return 0;
  }

  for (let lag = MIN_PERIOD + 1; lag < MAX_PERIOD; lag += 1) {
    const response = responses[lag] || 0;
    const isPeak =
      response >= (responses[lag - 1] || 0) && response >= (responses[lag + 1] || 0);

    if (isPeak && response >= best * FUNDAMENTAL_SHARE) {
      const previous = responses[lag - 1] || 0;
      const next = responses[lag + 1] || 0;
      const denominator = previous - 2 * response + next;
      const offset = denominator === 0 ? 0 : (0.5 * (previous - next)) / denominator;

      return lag + Math.max(-0.5, Math.min(0.5, offset));
    }
  }

  return 0;
};

/**
 * Положение линий по модулю шага: фаза первой гармоники ряда затемнений.
 * Гармоника, а не поиск самого тёмного бина, — линия шире пикселя, и её
 * середина лежит между отсчётами.
 *
 * @param darkness — ряд затемнений
 * @param period — шаг разлиновки
 * @returns фаза в бинах профиля от нуля до шага
 */
const measurePhase = (darkness: Float64Array, period: number): number => {
  let real = 0;
  let imaginary = 0;

  for (let index = 0; index < darkness.length; index += 1) {
    const angle = (2 * Math.PI * index) / period;

    real += (darkness[index] || 0) * Math.cos(angle);
    imaginary += (darkness[index] || 0) * Math.sin(angle);
  }

  const phase = (Math.atan2(imaginary, real) * period) / (2 * Math.PI);

  return ((phase % period) + period) % period;
};

/**
 * Ищет разлиновку на участке растра: сначала свипом — наклон, потом по нему —
 * шаг и фаза. Ни одна из трёх величин не берётся из характеристик экземпляра:
 * проверке нужно то, что видно на пикселях.
 *
 * @param raster — растр страницы
 * @param band — участок без чернил
 * @returns найденная разлиновка
 */
const measureRasterRuling = (raster: PageRaster, band: RasterBand): RasterRuling => {
  let tangent = 0;
  let contrast = 0;

  for (
    let candidate = -MAX_TANGENT;
    candidate <= MAX_TANGENT + TANGENT_STEP / 2;
    candidate += TANGENT_STEP
  ) {
    const spread = measureSpread(
      buildDarkness(buildProfile(raster, band, candidate).values)
    );

    if (spread > contrast) {
      contrast = spread;
      tangent = candidate;
    }
  }

  const profile = buildProfile(raster, band, tangent);
  const darkness = buildDarkness(profile.values);
  const period = measurePeriod(darkness);

  return {
    tangent,
    origin: profile.origin,
    period,
    phase: period > 0 ? measurePhase(darkness, period) : 0,
    contrast,
  };
};

/**
 * Базовые линии страницы в системе координат профиля.
 *
 * Считаются по той же модели строчного бокса, которой рисует рендерер:
 * `fillText` ставит текст на базовую линию `topOffset + fontAscent × кегль +
 * n × шаг строк`. Поворот блока учитывается делением на косинус — вдоль
 * наклона строка отстоит от верха листа именно на столько.
 *
 * @param probe — проба страницы
 * @param band — участок, по которому снят профиль
 * @param ruling — найденная на растре разлиновка: из неё берётся наклон и
 *   начало профиля
 * @returns положения базовых линий в бинах профиля
 */
const buildBaselines = (
  probe: RasterProbe,
  band: RasterBand,
  ruling: RasterRuling
): number[] => {
  const { geometry, page } = probe.params;
  const { fontSizePx, lineSpacing, topOffset, fontMetrics } = geometry;
  const lineStep = fontSizePx * fontMetrics.lineHeight + lineSpacing;
  const stretch = Math.hypot(1, ruling.tangent);
  const baselines: number[] = [];

  for (let index = 0; index < page.lines.length; index += 1) {
    const baseline = topOffset + fontMetrics.fontAscent * fontSizePx + index * lineStep;

    baselines.push(
      band.left * ruling.tangent + baseline * stretch - band.top - ruling.origin
    );
  }

  return baselines;
};

/**
 * Наибольшее отклонение базовых линий от ближайшей линии разлиновки в долях
 * шага.
 *
 * @param baselines — базовые линии в бинах профиля
 * @param ruling — найденная на растре разлиновка
 * @returns отклонение в долях шага
 */
const measureDrift = (baselines: number[], ruling: RasterRuling): number => {
  return baselines.reduce((drift, baseline) => {
    const lines = (baseline - ruling.phase) / ruling.period;

    return Math.max(drift, Math.abs(lines - Math.round(lines)));
  }, 0);
};

/**
 * Сколько пикселей чернил в каждом бине наклонного профиля.
 *
 * @param raster — растр страницы
 * @param band — участок со строками
 * @param tangent — наклон строк
 * @returns число тёмных пикселей по бинам сверху вниз
 */
const buildInkProfile = (
  raster: PageRaster,
  band: RasterBand,
  tangent: number
): ShearedProfile => {
  const height = band.bottom - band.top;
  const counts = new Float64Array(height);

  for (let x = band.left; x < band.right; x += 1) {
    const shift = Math.round((x - band.left) * tangent);

    for (let y = band.top; y < band.bottom; y += 1) {
      const bin = y - band.top - shift;
      const isInk = (raster.luminance[y * raster.width + x] || 0) < INK_LEVEL;

      if (isInk && bin >= 0 && bin < height) {
        counts[bin] = (counts[bin] || 0) + 1;
      }
    }
  }

  return { values: counts, origin: 0 };
};

/**
 * Низ строки чернил рядом с расчётной базовой линией.
 *
 * Считается именно низ, а не середина: на линию разлиновки садится базовая
 * линия, а середина строчного бокса стоит выше неё на половину высоты
 * строчных — сверять по ней значило бы получить постоянный сдвиг в четверть
 * шага.
 *
 * @param ink — профиль чернил
 * @param baseline — расчётная базовая линия в бинах профиля
 * @param lineStep — шаг строк
 * @returns низ строки в бинах профиля; `null` — строки рядом не нашлось
 */
const measureInkBottom = (
  ink: Float64Array,
  baseline: number,
  lineStep: number
): number | null => {
  const from = Math.max(0, Math.round(baseline - lineStep * 0.8));
  const to = Math.min(ink.length - 1, Math.round(baseline + lineStep * 0.3));
  let peak = 0;
  let peakIndex = -1;

  for (let index = from; index <= to; index += 1) {
    if ((ink[index] || 0) > peak) {
      peak = ink[index] || 0;
      peakIndex = index;
    }
  }

  if (peakIndex < 0 || peak <= 0) {
    return null;
  }

  let bottom = peakIndex;

  while (bottom + 1 <= to && (ink[bottom + 1] || 0) >= peak * INK_BASELINE_SHARE) {
    bottom += 1;
  }

  return peak > 0 && peak * INK_BAND_SHARE > 0 ? bottom : null;
};

/**
 * Наибольшее расхождение низа строк чернил с расчётными базовыми линиями в
 * долях шага разлиновки.
 *
 * @param raster — растр страницы
 * @param band — участок со строками
 * @param ruling — найденная на растре разлиновка
 * @param baselines — расчётные базовые линии в бинах профиля разлиновки
 * @param lineStep — шаг строк
 * @returns расхождение в долях шага разлиновки
 */
const measureInkOffset = (
  raster: PageRaster,
  band: RasterBand,
  ruling: RasterRuling,
  baselines: number[],
  lineStep: number
): number => {
  const ink = buildInkProfile(raster, band, ruling.tangent).values;

  return baselines.reduce((offset, baseline) => {
    const bottom = measureInkBottom(ink, baseline, lineStep);

    return bottom === null
      ? offset
      : Math.max(offset, Math.abs(bottom - baseline) / ruling.period);
  }, 0);
};

/**
 * Полоса без чернил внутри фотографии: ниже последней строки и выше нижнего
 * края листа. Столбцы берутся из середины фотографии — там нет ни линии поля,
 * ни полосы подложки.
 *
 * @param probe — проба страницы
 * @returns участок для замера; `null` — полосы не осталось
 */
const buildEmptyBand = (probe: RasterProbe): RasterBand | null => {
  const { params, family } = probe;
  const { background, geometry } = params;
  const { fontSizePx, lineSpacing, topOffset, fontMetrics } = geometry;

  if (!background) {
    return null;
  }

  const lineStep = fontSizePx * fontMetrics.lineHeight + lineSpacing;
  const lastBaseline =
    topOffset +
    fontMetrics.fontAscent * fontSizePx +
    Math.max(0, params.page.lines.length - 1) * lineStep;
  const top = Math.ceil(Math.max(background.y, lastBaseline + lineStep));
  const limit = Math.floor(Math.min(family.height, background.y + background.height));
  const bottom = Math.min(limit, top + MAX_BAND_STEPS * family.ruling.step);
  const left = Math.round(background.x + background.width * BAND_LEFT_SHARE);
  const right = Math.round(background.x + background.width * BAND_RIGHT_SHARE);

  if (bottom - top < MIN_BAND_STEPS * family.ruling.step || right - left < 2) {
    return null;
  }

  return { left: Math.max(0, left), right: Math.min(family.width, right), top, bottom };
};

/**
 * Ждёт страницу, нарисованную нужным экземпляром.
 *
 * @param sheetId — ожидаемый экземпляр листа
 * @param pageIndex — ожидаемая страница
 * @returns проба страницы
 */
const waitForProbe = async (sheetId: string, pageIndex: number): Promise<RasterProbe> => {
  /**
   * Ожидание идёт по метрикам шрифта: пока начертание не загрузилось,
   * геометрия считается по запасным пропорциям, строк на странице выходит
   * другое число, и «полоса без чернил» оказывается под текстом.
   */
  const metrics = await loadFontMetrics(DEFAULT_FONT);

  await waitFor(
    async () => {
      await expect(lastProbe?.sheetId).toBe(sheetId);
      await expect(lastProbe?.pageIndex).toBe(pageIndex);
      await expect(lastProbe?.params.fontFamily).toBe(DEFAULT_FONT);
      await expect(lastProbe?.params.geometry.fontMetrics.fontAscent).toBeCloseTo(
        metrics.fontAscent,
        6
      );
      await expect(lastProbe?.params.geometry.fontMetrics.lineHeight).toBeCloseTo(
        metrics.lineHeight,
        6
      );
      await expect(lastProbe?.params.page.lines.length || 0).toBeGreaterThan(1);
    },
    { timeout: 15_000 }
  );

  if (!lastProbe) {
    throw new Error('Проба не снялась: страница не собралась');
  }

  return lastProbe;
};

/**
 * Проверяет по растру нарисованной страницы, что разлиновка фотографии
 * совпадает с каноном семьи, а базовые линии сидят на линиях.
 *
 * @param probe — проба страницы
 * @param image — фотография выбранного экземпляра
 */
const expectRasterOnRuling = async (
  probe: RasterProbe,
  image: RenderImage
): Promise<void> => {
  const { family } = probe;
  const band = buildEmptyBand(probe);

  if (!band) {
    throw new Error(`Полосы без чернил не осталось: ${probe.sheetId}`);
  }

  const raster = renderProbeRaster(probe, image);
  const ruling = measureRasterRuling(raster, band);

  /**
   * Гребёнка найдена: без этого нулевой сдвиг фазы прошёл бы проверку на
   * пустом месте.
   */
  await expect(ruling.contrast).toBeGreaterThan(MIN_CONTRAST);

  /**
   * Шаг разлиновки на растре — канонический шаг семьи. Растяни отрисовка
   * фотографию под размер страницы, шаг ушёл бы на проценты, а строки — с
   * линий.
   */
  await expect(ruling.period).toBeGreaterThan(
    family.ruling.step * (1 - PERIOD_TOLERANCE)
  );
  await expect(ruling.period).toBeLessThan(family.ruling.step * (1 + PERIOD_TOLERANCE));

  /**
   * Наклон линий на растре — наклон блока текста. На отражённой странице
   * разлиновка вместе с листом переворачивается, и блок обязан наклониться в
   * ту же сторону.
   */
  const blockAngle = probe.params.geometry.blockRotate;
  const rasterAngle = (Math.atan(ruling.tangent) * 180) / Math.PI;

  await expect(Math.abs(rasterAngle - blockAngle)).toBeLessThan(ANGLE_TOLERANCE);

  /**
   * Строки садятся на линии: отклонение считается до ближайшей линии, потому
   * что на листе в клетку строка занимает две клетки.
   */
  const baselines = buildBaselines(probe, band, ruling);
  const rowSteps = family.ruling.kind === 'grid' ? GRID_ROW_STEPS : 1;
  const lineStep =
    probe.params.geometry.fontSizePx * probe.params.geometry.fontMetrics.lineHeight +
    probe.params.geometry.lineSpacing;

  /**
   * Строки и правда стоят там, где их посчитала геометрия: низ чернил каждой
   * строки лежит у своей базовой линии. Без этой сверки проверка говорила бы
   * только о разлиновке, а текст мог бы уехать сам по себе.
   */
  const inkBand: RasterBand = {
    left: band.left,
    right: band.right,
    top: Math.max(0, Math.round(probe.params.geometry.topOffset)),
    bottom: band.top,
  };

  const inkBaselines = baselines.map((baseline) => {
    return baseline + band.top + ruling.origin - inkBand.top;
  });

  await expect(
    measureInkOffset(raster, inkBand, ruling, inkBaselines, lineStep)
  ).toBeLessThanOrEqual(INK_TOLERANCE);

  await expect(lineStep / ruling.period).toBeCloseTo(rowSteps, 1);
  await expect(measureDrift(baselines, ruling)).toBeLessThanOrEqual(DRIFT_TOLERANCE);
};

/**
 * Ставит стор на известный лист и половину разворота.
 *
 * Искажения почерка выключены: они двигают слова и строки нарочно, а проверке
 * нужна сама раскладка.
 *
 * @param families — предустановленные семьи с измерениями
 * @param familyId — семья листов
 * @param sheetId — экземпляр листа
 * @param pageIndex — номер страницы, считая с нуля
 */
const applySheet = (
  families: PaperFamily[],
  familyId: string,
  sheetId: string,
  pageIndex: number
): void => {
  lastProbe = null;
  clearLayoutCache();
  useGeneratorStore.setState({
    ...DEFAULT_GENERATOR_STATE,
    presetFamilies: families,
    text: TEXT,
    familyId,
    sheetId,
    isSheetPinned: true,
    pageIndex,
    hasContourVariance: false,
  });
};

/**
 * Прогоняет проверку по всем экземплярам семьи на одной половине разворота.
 *
 * @param familyId — семья листов
 * @param pageIndex — номер страницы: чётная по счёту пользователя отражается
 */
const checkFamily = async (familyId: string, pageIndex: number): Promise<void> => {
  const families = await loadPaperFamilies();
  const family = families.find((item) => {
    return item.id === familyId;
  });

  if (!family) {
    throw new Error(`Семья не нашлась: ${familyId}`);
  }

  /**
   * Экземпляры обязаны быть измеренными: у листов без измерений нормировка
   * одна на всю семью, и проверка выродилась бы.
   */
  const scales = family.sheets.reduce<Set<number>>((acc, sheet) => {
    acc.add(sheet.normalizeScale);

    return acc;
  }, new Set<number>());

  await expect(scales.size).toBe(family.sheets.length);

  const isMirrored = pageIndex % 2 === 1;

  for (const sheet of family.sheets) {
    const photo = await loadRenderImage(sheet.src);
    const image = isMirrored
      ? mirrorRenderImage(photo, sheet.width, sheet.height)
      : photo;

    applySheet(families, familyId, sheet.id, pageIndex);

    await expectRasterOnRuling(await waitForProbe(sheet.id, pageIndex), image);
  }
};

const meta = {
  component: RasterRulingProbe,
} satisfies Meta<typeof RasterRulingProbe>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Растр нечётной страницы в клетку: разлиновка фотографии совпадает с каноном
 * семьи, а базовые линии сидят на линиях — на всех экземплярах семьи.
 */
export const GridRasterRuling: Story = {
  play: async () => {
    await checkFamily(GRID_FAMILY_ID, 0);
  },
};

/**
 * То же на чётной странице: лист отражён, разлиновка вместе с ним.
 */
export const MirroredGridRasterRuling: Story = {
  play: async () => {
    await checkFamily(GRID_FAMILY_ID, 1);
  },
};

/**
 * Растр нечётной страницы в линейку.
 */
export const LinedRasterRuling: Story = {
  play: async () => {
    await checkFamily(LINED_FAMILY_ID, 0);
  },
};

/**
 * Растр чётной страницы в линейку.
 */
export const MirroredLinedRasterRuling: Story = {
  play: async () => {
    await checkFamily(LINED_FAMILY_ID, 1);
  },
};
