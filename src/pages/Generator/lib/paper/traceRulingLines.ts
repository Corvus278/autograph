import { computeQuantile } from './quantile';
import { refinePeakOffset } from './sheetProfile';
import type { LineDip, TraceComb, TracedLine } from './traceRulingLines.types';

/**
 * Полуширина окна поиска линии в долях шага — и у стартовой линии, и у
 * предсказания трассы. Треть шага: предсказание идёт за дрейфом, а до соседней
 * линии окно не дотягивается.
 */
export const TRACE_SEARCH_SHARE = 1 / 3;

/**
 * Доля шага, на которую линия может уйти от арифметической гребёнки и всё ещё
 * считаться своей. У края кадра лист тянет объектив или изгиб страницы: на
 * снимках линейки пресет-пака нижние линии стоят на восьмую шага выше
 * предсказанного места. Шестая доля — запас сверх этого и всё ещё далеко от
 * половины шага, где окно доставало бы соседнюю линию.
 */
export const LINE_SEARCH_SHARE = 1 / 6;

/**
 * Квантиль глубин, которым меряется типичная глубина линии: линии видны не на
 * всём листе, и медиана на наполовину закрытом пятном листе упала бы до шума.
 */
const LINE_DEPTH_QUANTILE = 0.9;

/**
 * Доля типичной глубины, ниже которой линия в полосе считается ненайденной.
 * Та же десятая, что у измерения изгиба: линия под пятном мельче типичной в
 * несколько раз, но узел ищется только в окне у предсказания трассы, и чужой
 * провал в него не попадает.
 */
const LINE_DEPTH_LEVEL = 0.1;

/**
 * Границы местного шага трассы в долях шага ровного прохода. Дрейф внутри
 * гарантированных спекой восьми процентов в них помещается с запасом, а трасса,
 * перескочившая на соседнюю линию, за них выходит и дальше ведёт по своему шагу.
 */
const MIN_LOCAL_STEP_SHARE = 0.5;

const MAX_LOCAL_STEP_SHARE = 1.5;

/**
 * Самый глубокий провал в окне вокруг предсказанного положения линии, уточнённый
 * параболой по трём отсчётам. Центроида, как у измерения изгиба, здесь нет:
 * внутри полосы линия прямая, и её провал симметричен.
 *
 * @param detrended — профиль полосы без фона, отрицательный на линиях
 * @param center — предсказанная координата линии в бинах
 * @param reach — полуширина окна в бинах
 * @returns провал; `null` — в окне нет вершины темнее фона, а край окна лежит на
 *   склоне провала за окном
 */
const findLineDip = (
  detrended: Float64Array,
  center: number,
  reach: number
): LineDip | null => {
  const from = Math.max(1, Math.round(center - reach));
  const to = Math.min(detrended.length - 2, Math.round(center + reach));
  let peak = -1;
  let depth = 0;

  for (let bin = from; bin <= to; bin += 1) {
    const binDepth = -(detrended[bin] || 0);

    if (binDepth > depth) {
      peak = bin;
      depth = binDepth;
    }
  }

  if (peak < 0) {
    return null;
  }

  const previous = -(detrended[peak - 1] || 0);
  const next = -(detrended[peak + 1] || 0);

  if (previous > depth || next > depth) {
    return null;
  }

  return { position: peak + refinePeakOffset(previous, depth, next), depth };
};

/**
 * Провал у предсказания, если он не мельче порога трассы.
 *
 * @param detrended — профиль полосы без фона
 * @param predicted — предсказанная координата линии в бинах
 * @param reach — полуширина окна в бинах
 * @param threshold — наименьшая глубина провала
 * @returns линия в полосе
 */
const traceLine = (
  detrended: Float64Array,
  predicted: number,
  reach: number,
  threshold: number
): TracedLine => {
  const dip = findLineDip(detrended, predicted, reach);

  return { predicted, dip: dip !== null && dip.depth >= threshold ? dip : null };
};

/**
 * Разносит старт опорной линии по всем полосам: от опорной полосы к краям,
 * предсказывая положение в следующей полосе по двум последним и уточняя его
 * провалом, если он там есть.
 *
 * Старт у всех полос — на одной и той же линии гребёнки, поэтому номера линий
 * общие. Искать старт в каждой полосе у прямой гребёнки нельзя: прогиб бумаги в
 * полшага уводит линию из окна поиска целиком, и полосы в середине прогиба
 * остались бы без узлов. Между соседними полосами тот же прогиб меняется на
 * малую долю шага, и предсказание от соседа в окно укладывается.
 *
 * @param detrended — профили полос без фона
 * @param anchorStrip — полоса, где линия нашлась у прямой гребёнки
 * @param anchor — провал линии в ней
 * @param reach — полуширина окна поиска в бинах
 * @param threshold — наименьшая глубина провала
 * @returns старт опорной линии в каждой полосе
 */
const spreadStart = (
  detrended: Float64Array[],
  anchorStrip: number,
  anchor: LineDip,
  reach: number,
  threshold: number
): TracedLine[] => {
  const starts: TracedLine[] = detrended.map(() => {
    return { predicted: anchor.position, dip: null };
  });

  starts[anchorStrip] = { predicted: anchor.position, dip: anchor };

  for (const direction of [-1, 1]) {
    let previous = anchor.position;
    let slope = 0;

    for (
      let strip = anchorStrip + direction;
      strip >= 0 && strip < detrended.length;
      strip += direction
    ) {
      const start = traceLine(
        detrended[strip] || new Float64Array(0),
        previous + slope,
        reach,
        threshold
      );
      const position = start.dip === null ? start.predicted : start.dip.position;

      starts[strip] = start;
      slope = position - previous;
      previous = position;
    }
  }

  return starts;
};

/**
 * Прослеживает линии по высоте в одной полосе от стартовой линии вверх и вниз.
 * Предсказание — предыдущая линия плюс местный шаг: шаг следует за дрейфом, и
 * номер линии не проскальзывает. Поиск у ровной гребёнки в каждой полосе на
 * дрейфе в восемь процентов уходил бы к краям листа на соседнюю линию.
 *
 * Местный шаг и опора трассы берутся от найденной линии, только если промежуток
 * до неё отличается от местного шага не больше чем на `LINE_SEARCH_SHARE` шага:
 * провал дальше — не своя линия, а текст, пятно или волна, и трасса, пошедшая
 * от него, уехала бы на соседнюю линию. Сама линия при этом остаётся найденной.
 *
 * @param detrended — профиль полосы без фона
 * @param start — стартовая линия в полосе
 * @param startIndex — её индекс среди прослеживаемых линий
 * @param count — число прослеживаемых линий
 * @param step — шаг ровного прохода
 * @param threshold — наименьшая глубина провала
 * @returns линии полосы по порядку индексов
 */
const traceStrip = (
  detrended: Float64Array,
  start: TracedLine,
  startIndex: number,
  count: number,
  step: number,
  threshold: number
): TracedLine[] => {
  const reach = step * TRACE_SEARCH_SHARE;
  const startPosition = start.dip === null ? start.predicted : start.dip.position;
  const lines: TracedLine[] = Array.from({ length: count }, () => {
    return start;
  });

  for (const direction of [-1, 1]) {
    let previous = startPosition;
    let localStep = step;

    for (
      let index = startIndex + direction;
      index >= 0 && index < count;
      index += direction
    ) {
      const line = traceLine(
        detrended,
        previous + direction * localStep,
        reach,
        threshold
      );
      const distance = line.dip === null ? 0 : Math.abs(line.dip.position - previous);
      const isOwnStep =
        line.dip !== null && Math.abs(distance - localStep) <= step * LINE_SEARCH_SHARE;

      lines[index] = line;

      if (isOwnStep && line.dip !== null) {
        localStep = Math.min(
          Math.max(distance, step * MIN_LOCAL_STEP_SHARE),
          step * MAX_LOCAL_STEP_SHARE
        );
        previous = line.dip.position;
      } else {
        previous = line.predicted;
      }
    }
  }

  return lines;
};

/**
 * Прослеживает линии гребёнки вдоль самих линий по полосам профиля: старт — на
 * линии у середины, найденной у прямой гребёнки, дальше он разносится по
 * полосам и в каждой полосе ведётся вверх и вниз с местным шагом. Линия, ушедшая
 * от прямой гребёнки на волне или в перспективе, так остаётся своей, а опрос у
 * прямой гребёнки на ней пустеет.
 *
 * Порог найденной линии — десятая доля типичной глубины у прямой гребёнки:
 * провал ищется только в окне у предсказания трассы, и чужой в него не попадает.
 *
 * @param detrended — профили полос без фона с общими бинами
 * @param comb — ровная гребёнка и диапазон номеров линий
 * @returns линии по индексам от `firstLine`, в каждой — по полосам; `null` —
 *   линий нет ни в одной полосе
 */
export const traceRulingLines = (
  detrended: Float64Array[],
  comb: TraceComb
): TracedLine[][] | null => {
  const { lineOffset, step, firstLine, lastLine, middleLine } = comb;
  const count = lastLine - firstLine + 1;
  const reach = step * TRACE_SEARCH_SHARE;

  if (count <= 0 || detrended.length === 0) {
    return null;
  }

  const straightDips = Array.from({ length: count }, (_item, index) => {
    return detrended.map((profile) => {
      return findLineDip(profile, lineOffset + (firstLine + index) * step, reach);
    });
  });
  const threshold =
    LINE_DEPTH_LEVEL *
    computeQuantile(
      straightDips.flat().map((dip) => {
        return dip === null ? 0 : dip.depth;
      }),
      LINE_DEPTH_QUANTILE
    );

  if (threshold <= 0) {
    return null;
  }

  /**
   * Ближайшая к середине линия может быть закрыта пятном, поэтому стартом
   * служит ближайшая к середине, найденная хотя бы в одной полосе.
   */
  const middleIndex = Math.min(count - 1, Math.max(0, middleLine - firstLine));
  const anchorIndex = Array.from({ length: count }, (_item, index) => {
    return index;
  })
    .sort((first, second) => {
      return (
        Math.abs(first - middleIndex) - Math.abs(second - middleIndex) || first - second
      );
    })
    .find((index) => {
      return (straightDips[index] || []).some((dip) => {
        return (dip?.depth || 0) >= threshold;
      });
    });

  if (anchorIndex === undefined) {
    return null;
  }

  const anchorDips = straightDips[anchorIndex] || [];
  const anchorStrip = anchorDips.reduce((best, dip, strip) => {
    const depth = dip?.depth || 0;
    const bestDepth = best < 0 ? 0 : anchorDips[best]?.depth || 0;

    return depth >= threshold && depth > bestDepth ? strip : best;
  }, -1);
  const anchor = anchorDips[anchorStrip];

  if (!anchor) {
    return null;
  }

  const starts = spreadStart(detrended, anchorStrip, anchor, reach, threshold);
  const strips = detrended.map((profile, strip) => {
    return traceStrip(
      profile,
      starts[strip] || { predicted: anchor.position, dip: null },
      anchorIndex,
      count,
      step,
      threshold
    );
  });

  return Array.from({ length: count }, (_item, index) => {
    return strips.map((lines) => {
      return lines[index] || { predicted: 0, dip: null };
    });
  });
};
