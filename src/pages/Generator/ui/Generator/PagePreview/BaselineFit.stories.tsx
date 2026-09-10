import type { Meta, StoryObj } from '@storybook/react-vite';
import type { FC } from 'react';
import { useEffect } from 'react';
import { expect, waitFor } from 'storybook/test';
import { useShallow } from 'zustand/react/shallow';

import { GRID_FAMILY_ID, HANDWRITING_FONTS, LINED_FAMILY_ID } from '../../../config';
import { loadFontMetrics } from '../../../lib/measure/measureFontMetrics';
import type { PaperFamily } from '../../../lib/paper';
import { isMirroredPage } from '../../../model/buildPageRenderParams';
import { clearLayoutCache } from '../../../model/measureLayout';
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
 * Снимок того, как страница легла на лист. Числа сняты с тех самых параметров,
 * которыми рендерер рисует страницу, и с разлиновки семьи, — считать
 * попадание по чему-то другому значило бы проверять не то, что видно.
 */
type BaselineProbe = {
  /**
   * Семейство шрифта страницы.
   */
  fontFamily: string;

  /**
   * Кегль в канонических пикселях семьи.
   */
  fontSizePx: number;

  /**
   * Добавка к естественной высоте строки в канонических пикселях.
   */
  lineSpacing: number;

  /**
   * Отступ верха первой строки от верха листа.
   */
  topOffset: number;

  /**
   * Угол наклона блока в градусах: у ровного экземпляра — ноль, и только на
   * нём попадание считается в канонических координатах листа.
   */
  blockRotate: number;

  /**
   * Подъём строчного бокса над базовой линией в долях кегля.
   */
  fontAscent: number;

  /**
   * Естественная высота строчного бокса в долях кегля.
   */
  lineHeight: number;

  /**
   * Шаг разлиновки семьи в канонических пикселях.
   */
  step: number;

  /**
   * Отступ первой линии разлиновки от верха листа.
   */
  firstLineOffset: number;

  /**
   * Число строк на показанной странице.
   */
  lineCount: number;
};

/**
 * Снимок того, как на страницу легла фотография листа. Проба именно
 * разлиновки: базовые линии считаются по канону семьи, и без этого снимка
 * никакая проверка не увидела бы, что разлиновка на самой фотографии от канона
 * уехала.
 */
type SheetRulingProbe = {
  /**
   * Идентификатор экземпляра, чья фотография ушла в отрисовку.
   */
  sheetId: string;

  /**
   * Номер показанной страницы: у половин разворота укладка разная, а
   * экземпляр один и тот же.
   */
  pageIndex: number;

  /**
   * Шаг разлиновки, измеренный на фотографии, в её пикселях.
   */
  measuredStep: number;

  /**
   * Коэффициент приведения фотографии к каноническому шагу семьи.
   */
  normalizeScale: number;

  /**
   * Смещение первой линии от верха фотографии в её пикселях.
   */
  firstLinePhase: number;

  /**
   * Наклон разлиновки экземпляра в градусах.
   */
  skewAngle: number;

  /**
   * Отражена ли страница: правая половина разворота.
   */
  isMirrored: boolean;

  /**
   * Высота фотографии в её собственных пикселях.
   */
  photoHeight: number;

  /**
   * Отступ левого края фотографии от левого края страницы.
   */
  backgroundX: number;

  /**
   * Отступ верхнего края фотографии от верха страницы.
   */
  backgroundY: number;

  /**
   * Ширина фотографии на странице в канонических пикселях.
   */
  backgroundWidth: number;

  /**
   * Высота фотографии на странице в канонических пикселях.
   */
  backgroundHeight: number;

  /**
   * Ширина канонического листа семьи.
   */
  pageWidth: number;

  /**
   * Шаг разлиновки семьи в канонических пикселях.
   */
  step: number;

  /**
   * Отступ первой линии разлиновки от верха листа.
   */
  firstLineOffset: number;
};

/**
 * Последнее измерение пробы. Передаётся не через DOM: числа с плавающей точкой
 * пришлось бы печатать в разметку и разбирать обратно, а проверке нужны те же
 * значения, что ушли в рендерер.
 */
let lastProbe: BaselineProbe | null = null;
let lastSheetProbe: SheetRulingProbe | null = null;

/**
 * Текст на много строк: попадание на одной строке ничего не значит —
 * расхождение шага строк с шагом разлиновки копится и видно только к концу
 * страницы. Длины хватает и на семью в клетку, где строка занимает две клетки
 * и кегль выходит мельче, чем в линейку.
 */
const LONG_TEXT = [
  'Рукописный текст ложится на разлиновку тетрадного листа строка за строкой,',
  'и чем дальше от начала страницы, тем заметнее любое расхождение шага строк',
  'с шагом линий: к низу листа текст либо держится линий, либо уезжает от них',
  'на целую строку, и никакой подкрутки настроек это уже не спасает.',
  'Кегль, межстрочный интервал и верхний отступ блока никто не задаёт руками:',
  'их выводит автокалибровка из шага разлиновки семьи и метрик выбранного',
  'шрифта, снятых в браузере на настоящем начертании, а не на подстановочном.',
  'Поэтому проверять попадание нужно именно в браузере и именно на нескольких',
  'шрифтах: у каждого своя высота строчных, свой подъём строчного бокса и своя',
  'естественная высота строки, и любая из этих величин способна увести текст',
  'с линий, если формулы расчёта и отрисовки разойдутся хотя бы в одном шаге.',
].join(' ');

/**
 * Допустимое отклонение базовой линии от линии разлиновки в долях шага.
 */
const DRIFT_TOLERANCE = 0.1;

/**
 * Сколько строк должно лечь на страницу, чтобы проверка что-то значила.
 */
const MIN_LINE_COUNT = 8;

/**
 * Шрифты, на которых проверяется попадание. Первые из пресета: расхождение
 * метрик ловится уже на нескольких начертаниях, а прогонять все шестнадцать —
 * минуты в браузере на пустом месте.
 */
const CHECKED_FONTS = HANDWRITING_FONTS.slice(0, 5).map(({ family }) => {
  return family;
});

/**
 * Шрифт, с которым генератор открывается: на нём проверяются обе семьи.
 */
const DEFAULT_FONT = HANDWRITING_FONTS[0]?.family || '';

/**
 * Проба попадания базовых линий на разлиновку.
 *
 * Раскладку и отрисовку берёт теми же хуками, что и экран генератора: кегль,
 * межстрочный интервал и верхний отступ выведены автокалибровкой из
 * разлиновки семьи и метрик шрифта, снятых живым измерителем браузера. В
 * jsdom такую проверку не поставить — там метрики шрифта взять неоткуда.
 */
const BaselineFitProbe: FC = () => {
  const pages = usePageLayout();
  const source = usePageRender(pages);
  const { family } = usePageGeometry();
  /**
   * Экземпляр берётся по выбору из стора, а не по раздаче рецепта: проба
   * разлиновки снимается только на закреплённом листе, и тогда выбранный лист
   * — тот самый, который ушёл в отрисовку.
   */
  const { sheetId, isSheetPinned, pageIndex } = useGeneratorStore(
    useShallow((state) => {
      return {
        sheetId: state.sheetId,
        isSheetPinned: state.isSheetPinned,
        pageIndex: state.pageIndex,
      };
    })
  );
  const params = source ? source.buildParams(1) : null;
  const sheet = family ? findSheet(family, sheetId) : undefined;
  const background = params?.background || null;
  const sheetProbe: SheetRulingProbe | null =
    family && background && sheet && isSheetPinned
      ? {
          sheetId: sheet.id,
          pageIndex,
          measuredStep: sheet.measuredStep,
          normalizeScale: sheet.normalizeScale,
          firstLinePhase: sheet.firstLinePhase,
          skewAngle: sheet.skewAngle,
          isMirrored: isMirroredPage(pageIndex),
          photoHeight: sheet.height,
          backgroundX: background.x,
          backgroundY: background.y,
          backgroundWidth: background.width,
          backgroundHeight: background.height,
          pageWidth: family.width,
          step: family.ruling.step,
          firstLineOffset: family.ruling.firstLineOffset,
        }
      : null;
  const probe: BaselineProbe | null =
    family && params
      ? {
          fontFamily: params.fontFamily,
          fontSizePx: params.geometry.fontSizePx,
          lineSpacing: params.geometry.lineSpacing,
          topOffset: params.geometry.topOffset,
          blockRotate: params.geometry.blockRotate,
          fontAscent: params.geometry.fontMetrics.fontAscent,
          lineHeight: params.geometry.fontMetrics.lineHeight,
          step: family.ruling.step,
          firstLineOffset: family.ruling.firstLineOffset,
          lineCount: params.page.lines.length,
        }
      : null;

  /**
   * Без списка зависимостей: проба снимается на каждый рендер — метрики
   * шрифта и раскладка доезжают асинхронно, и важно последнее состояние.
   */
  useEffect(() => {
    lastProbe = probe;
    lastSheetProbe = sheetProbe;
  });

  return (
    <p data-testid="baseline-probe">
      {probe
        ? `${probe.fontFamily}: строк ${probe.lineCount}, кегль ${probe.fontSizePx.toFixed(2)}`
        : 'страница не собралась'}
    </p>
  );
};

/**
 * Шаг строк страницы в канонических пикселях: расстояние между базовыми
 * линиями соседних строк.
 *
 * @param probe — снимок параметров отрисовки
 * @returns шаг строк
 */
const measureLineStep = (probe: BaselineProbe): number => {
  const { fontSizePx, lineHeight, lineSpacing } = probe;

  return fontSizePx * lineHeight + lineSpacing;
};

/**
 * Наибольшее отклонение базовых линий страницы от линий разлиновки в долях
 * шага.
 *
 * Базовые линии считаются по модели рендерера: `topOffset + fontAscent *
 * fontSizePx + n * (fontSizePx * lineHeight + lineSpacing)`. Линии разлиновки
 * идут от `firstLineOffset` через `step`, поэтому попадание — это расстояние
 * до ближайшей из них: на листе в клетку строка занимает две клетки, и
 * базовая линия садится на каждую вторую линию.
 *
 * @param probe — снимок параметров отрисовки и разлиновки
 * @returns отклонение в долях шага разлиновки
 */
const measureBaselineDrift = (probe: BaselineProbe): number => {
  const { topOffset, fontSizePx, fontAscent } = probe;
  const { step, firstLineOffset, lineCount } = probe;
  const lineStep = measureLineStep(probe);
  let drift = 0;

  for (let index = 0; index < lineCount; index += 1) {
    const baselineY = topOffset + fontAscent * fontSizePx + index * lineStep;
    const lines = (baselineY - firstLineOffset) / step;

    drift = Math.max(drift, Math.abs(lines - Math.round(lines)));
  }

  return drift;
};

/**
 * Ждёт, пока страница ляжет выбранным шрифтом, и отдаёт снятую пробу.
 *
 * Ожидание идёт по метрикам: шрифт грузится и меряется асинхронно, и до
 * замера геометрия считается по запасным пропорциям — попадание на линиях
 * такой страницы ничего не сказало бы о самом шрифте. Метрики проба сверяет с
 * замером живого щупа: так видно, что в отрисовку ушли пропорции именно этого
 * начертания.
 *
 * @param fontFamily — ожидаемое семейство шрифта страницы
 * @returns проба, снятая на метриках этого шрифта
 */
const waitForProbe = async (fontFamily: string): Promise<BaselineProbe> => {
  const metrics = await loadFontMetrics(fontFamily);

  await waitFor(
    async () => {
      await expect(lastProbe?.fontFamily).toBe(fontFamily);
      await expect(lastProbe?.fontAscent).toBeCloseTo(metrics.fontAscent, 6);
      await expect(lastProbe?.lineHeight).toBeCloseTo(metrics.lineHeight, 6);
      await expect(lastProbe?.lineCount || 0).toBeGreaterThanOrEqual(MIN_LINE_COUNT);
    },
    { timeout: 15_000 }
  );

  if (!lastProbe) {
    throw new Error('Проба не снялась: страница не собралась');
  }

  return lastProbe;
};

/**
 * Проверяет, что базовые линии сели на разлиновку.
 *
 * @param probe — снятая проба
 */
const expectBaselinesOnRuling = async (probe: BaselineProbe): Promise<void> => {
  /**
   * Наклона нет: попадание считается в канонических координатах листа, а
   * повёрнутый блок садится на линии повёрнутой фотографии — это другая
   * проверка.
   */
  await expect(probe.blockRotate).toBe(0);

  /**
   * Строка занимает не меньше линии разлиновки: сойдись шаг строк в ноль,
   * строки легли бы одна на другую, а отклонение от линий всё равно вышло бы
   * нулевым — попадание проверяется вместе с тем, что строки расходятся.
   */
  await expect(measureLineStep(probe)).toBeGreaterThanOrEqual(probe.step);
  await expect(measureBaselineDrift(probe)).toBeLessThanOrEqual(DRIFT_TOLERANCE);
};

/**
 * Ставит стор в известное состояние и забывает прошлую пробу: семья листов —
 * из аргумента, всё остальное по умолчанию. Экземпляры пресет-пака без измерений сняты ровно по
 * канону семьи, поэтому наклона у них нет и линии листа совпадают с
 * каноническими.
 *
 * @param familyId — семья листов
 */
const applyFamily = (familyId: string): void => {
  lastProbe = null;
  clearLayoutCache();
  useGeneratorStore.setState({
    ...DEFAULT_GENERATOR_STATE,
    text: LONG_TEXT,
    familyId,
  });
};

const meta = {
  component: BaselineFitProbe,
  beforeEach: () => {
    applyFamily(LINED_FAMILY_ID);
  },
} satisfies Meta<typeof BaselineFitProbe>;

export default meta;

type Story = StoryObj<typeof meta>;

export const LinedRuling: Story = {
  play: async () => {
    await expectBaselinesOnRuling(await waitForProbe(DEFAULT_FONT));
  },
};

export const GridRuling: Story = {
  beforeEach: () => {
    applyFamily(GRID_FAMILY_ID);
  },
  play: async () => {
    await expectBaselinesOnRuling(await waitForProbe(DEFAULT_FONT));
  },
};

/**
 * Смена встроенного шрифта не требует правки настроек: кегль и межстрочный
 * интервал выводятся из метрик нового начертания, и текст остаётся на линиях.
 */
export const FontSwitchKeepsRuling: Story = {
  play: async () => {
    const { setFontFamily } = useGeneratorStore.getState();

    for (const fontFamily of CHECKED_FONTS) {
      setFontFamily(fontFamily);

      await expectBaselinesOnRuling(await waitForProbe(fontFamily));
    }

    /**
     * Ни один слайдер геометрии не двигался: попадание держится расчётом, а
     * не поправкой пользователя.
     */
    await expect(useGeneratorStore.getState().geometryCorrection).toEqual(
      DEFAULT_GENERATOR_STATE.geometryCorrection
    );
  },
};

/**
 * Наибольшее отклонение линий разлиновки самой фотографии от канонических
 * линий страницы в долях шага.
 *
 * Линии считаются по прямоугольнику, которым рендерер кладёт фотографию на
 * страницу: фаза первой линии и шаг переводятся в канонические пиксели тем же
 * масштабом, что и вся фотография. Растянись фотография по размеру страницы —
 * её шаг разошёлся бы с каноническим, и отклонение росло бы от линии к линии.
 *
 * @param probe — снимок укладки фотографии
 * @returns отклонение в долях канонического шага
 */
const measureSheetRulingDrift = (probe: SheetRulingProbe): number => {
  const { measuredStep, firstLinePhase, photoHeight, skewAngle, isMirrored } = probe;
  const { backgroundY, backgroundHeight, step, firstLineOffset, pageWidth } = probe;
  const scale = backgroundHeight / photoHeight;
  const lineCount = Math.floor(photoHeight / measuredStep);
  /**
   * Отражение переворачивает наклон разлиновки, поэтому у левого края страницы
   * — там, где рендерер отсчитывает базовые линии, — оказывается линия,
   * опущенная на наклон во всю ширину страницы.
   */
  const tilt = isMirrored ? Math.tan((skewAngle * Math.PI) / 180) * pageWidth : 0;
  let drift = 0;

  for (let index = 0; index < lineCount; index += 1) {
    const lineY = backgroundY + (firstLinePhase + index * measuredStep) * scale + tilt;
    const lines = (lineY - firstLineOffset) / step;

    drift = Math.max(drift, Math.abs(lines - Math.round(lines)));
  }

  return drift;
};

/**
 * Сколько разных коэффициентов нормировки у экземпляров семьи. У пресетов без
 * измерений он один на всю семью, поэтому число больше единицы означает, что в
 * дело пошёл артефакт профилей с настоящими замерами фотографий.
 *
 * @param family — семья листов
 * @returns число разных коэффициентов нормировки
 */
const countNormalizeScales = (family: PaperFamily): number => {
  const scales = family.sheets.reduce<Set<number>>((acc, sheet) => {
    acc.add(sheet.normalizeScale);

    return acc;
  }, new Set<number>());

  return scales.size;
};

/**
 * Ждёт, пока страница нарисуется закреплённым экземпляром, и отдаёт снятую
 * пробу его укладки.
 *
 * @param sheetId — ожидаемый экземпляр листа
 * @param pageIndex — ожидаемая страница
 * @returns проба укладки фотографии этого экземпляра
 */
const waitForSheetProbe = async (
  sheetId: string,
  pageIndex: number
): Promise<SheetRulingProbe> => {
  /**
   * Ожидание с запасом: проба снимается только когда фотография уже
   * загрузилась, а каждый экземпляр пресет-пака — это отдельный файл в
   * полмегабайта.
   */
  await waitFor(
    async () => {
      await expect(lastSheetProbe?.sheetId).toBe(sheetId);
      await expect(lastSheetProbe?.pageIndex).toBe(pageIndex);
    },
    { timeout: 15_000 }
  );

  if (!lastSheetProbe) {
    throw new Error('Проба не снялась: фотография не легла на страницу');
  }

  return lastSheetProbe;
};

/**
 * Проверяет, что разлиновка фотографии села на канон семьи.
 *
 * @param probe — снятая проба укладки
 * @param isMirrored — страница отражена: правая половина разворота
 */
const expectSheetRulingOnCanon = async (
  probe: SheetRulingProbe,
  isMirrored: boolean
): Promise<void> => {
  const scale = probe.backgroundHeight / probe.photoHeight;

  /**
   * Масштаб укладки — коэффициент нормировки экземпляра: только при нём шаг
   * фотографии становится каноническим шагом семьи.
   */
  await expect(scale).toBeCloseTo(probe.normalizeScale, 6);
  await expect(probe.measuredStep * scale).toBeCloseTo(probe.step, 6);
  await expect(measureSheetRulingDrift(probe)).toBeLessThanOrEqual(DRIFT_TOLERANCE);

  /**
   * Отражённая страница прижата к правому краю: после отражения разлиновка
   * вместе с линией поля уходит туда же, куда и отступ блока.
   */
  await expect(
    isMirrored ? probe.backgroundX + probe.backgroundWidth : probe.backgroundX
  ).toBeCloseTo(isMirrored ? probe.pageWidth : 0, 6);
};

/**
 * Разлиновка настоящих фотографий пресет-пака садится на канон семьи.
 *
 * Экземпляры берутся из артефакта профилей, а не из пресетов без измерений: у
 * измеренных экземпляров шаг на фотографии отличается от канонического, и
 * только на них видно, применилась ли нормировка. Проверяются обе половины
 * разворота: у отражённой страницы фаза считается от отражённой разлиновки.
 */
export const PhotoRulingMatchesCanon: Story = {
  play: async () => {
    const families = await loadPaperFamilies();
    const { setPresetFamilies, selectFamily, selectSheet, goToPage } =
      useGeneratorStore.getState();

    setPresetFamilies(families);

    for (const family of families) {
      selectFamily(family.id);

      /**
       * Без артефакта профилей проверять нечего: у экземпляров без измерений
       * нормировка одна на всю семью, и подмена её растяжением по странице
       * прошла бы незамеченной.
       */
      await expect(countNormalizeScales(family)).toBeGreaterThan(1);

      for (const sheet of family.sheets) {
        selectSheet(sheet.id);

        for (const pageIndex of [0, 1]) {
          goToPage(pageIndex);

          await expectSheetRulingOnCanon(
            await waitForSheetProbe(sheet.id, pageIndex),
            pageIndex % 2 === 1
          );
        }
      }
    }
  },
};
