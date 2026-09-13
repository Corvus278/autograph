import type { Meta, StoryObj } from '@storybook/react-vite';
import type { FC } from 'react';
import { useEffect } from 'react';
import { expect, waitFor } from 'storybook/test';

import { GRID_FAMILY_ID, HANDWRITING_FONTS, LINED_FAMILY_ID } from '../../../config';
import { loadFontMetrics } from '../../../lib/measure/measureFontMetrics';
import type { PaperFamily } from '../../../lib/paper';
import { clearLayoutCache } from '../../../model/measureLayout';
import { loadPaperFamilies } from '../../../model/paperProfiles';
import {
  DEFAULT_GENERATOR_STATE,
  useGeneratorStore,
} from '../../../model/useGeneratorStore';
import { usePageGeometry } from '../../../model/usePageGeometry';
import { usePageLayout } from '../../../model/usePageLayout';
import { usePageRender } from '../../../model/usePageRender';

/**
 * Снимок того, как страница легла на лист. Числа сняты с тех самых параметров,
 * которыми рендерер рисует страницу, и с разлиновки листа этой страницы, —
 * считать попадание по чему-то другому значило бы проверять не то, что видно.
 */
type BaselineProbe = {
  /**
   * Экземпляр листа, доставшийся странице.
   */
  sheetId: string;

  /**
   * Лист, под который разложена показанная страница. Раскладка под новый лист
   * пересчитывается асинхронно и до того отстаёт от листа страницы.
   */
  layoutSheetId: string;

  /**
   * Номер показанной страницы, считая с нуля.
   */
  pageIndex: number;

  /**
   * Семейство шрифта страницы.
   */
  fontFamily: string;

  /**
   * Кегль в пикселях кадра листа.
   */
  fontSizePx: number;

  /**
   * Добавка к естественной высоте строки в пикселях кадра листа.
   */
  lineSpacing: number;

  /**
   * Отступ верха первой строки от верха страницы до поворота блока.
   */
  topOffset: number;

  /**
   * Угол наклона блока в градусах. Блок поворачивается вокруг левого верхнего
   * угла страницы.
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
   * Шаг разлиновки листа страницы в пикселях кадра.
   */
  step: number;

  /**
   * Высота одной из линий разлиновки страницы у левого края кадра.
   */
  firstLinePhase: number;

  /**
   * Наклон разлиновки страницы в градусах; на чётной странице — отражённый.
   */
  skewAngle: number;

  /**
   * Число строк на показанной странице.
   */
  lineCount: number;

  /**
   * Ширина страницы в пикселях.
   */
  pageWidth: number;

  /**
   * Высота страницы в пикселях.
   */
  pageHeight: number;
};

/**
 * Последнее измерение пробы. Передаётся не через DOM: числа с плавающей точкой
 * пришлось бы печатать в разметку и разбирать обратно, а проверке нужны те же
 * значения, что ушли в рендерер.
 */
let lastProbe: BaselineProbe | null = null;

/**
 * Текст на много строк: попадание на одной строке ничего не значит —
 * расхождение шага строк с шагом разлиновки копится и видно только к концу
 * страницы. Длины хватает и на семью в клетку, где строка занимает две клетки.
 */
const LONG_TEXT = [
  'Рукописный текст ложится на разлиновку тетрадного листа строка за строкой,',
  'и чем дальше от начала страницы, тем заметнее любое расхождение шага строк',
  'с шагом линий: к низу листа текст либо держится линий, либо уезжает от них',
  'на целую строку, и никакой подкрутки настроек это уже не спасает.',
  'Кегль, межстрочный интервал и верхний отступ блока никто не задаёт руками:',
  'их выводит автокалибровка из шага разлиновки листа и метрик выбранного',
  'шрифта, снятых в браузере на настоящем начертании, а не на подстановочном.',
  'Поэтому проверять попадание нужно именно в браузере и именно на нескольких',
  'шрифтах: у каждого своя высота строчных, свой подъём строчного бокса и своя',
  'естественная высота строки, и любая из этих величин способна увести текст',
  'с линий, если формулы расчёта и отрисовки разойдутся хотя бы в одном шаге.',
].join(' ');

/**
 * Текст на разворот: и на второй, отражённой, странице должно лечь не меньше
 * строк, чем нужно для проверки.
 */
const SPREAD_TEXT = [LONG_TEXT, LONG_TEXT, LONG_TEXT].join('\n');

/**
 * Допустимое отклонение базовой линии от линии разлиновки в долях шага.
 */
const DRIFT_TOLERANCE = 0.1;

/**
 * Допуск сравнения шага строк с шагом разлиновки: шаг строк складывается из
 * кегля и интервала, и равенство теряется в последнем знаке.
 */
const STEP_EPSILON = 1e-9;

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
 * разлиновки листа и метрик шрифта, снятых живым измерителем браузера. В
 * jsdom такую проверку не поставить — там метрики шрифта взять неоткуда.
 */
const BaselineFitProbe: FC = () => {
  const pages = usePageLayout();
  const source = usePageRender(pages);
  const { sheet, ruling } = usePageGeometry();
  const pageIndex = useGeneratorStore((state) => {
    return state.pageIndex;
  });
  const params = source ? source.buildParams(1) : null;
  const probe: BaselineProbe | null =
    source && params && sheet && ruling
      ? {
          sheetId: sheet.id,
          layoutSheetId: pages[pageIndex]?.sheetId || '',
          pageIndex,
          fontFamily: params.fontFamily,
          fontSizePx: params.geometry.fontSizePx,
          lineSpacing: params.geometry.lineSpacing,
          topOffset: params.geometry.topOffset,
          blockRotate: params.geometry.blockRotate,
          fontAscent: params.geometry.fontMetrics.fontAscent,
          lineHeight: params.geometry.fontMetrics.lineHeight,
          step: ruling.step,
          firstLinePhase: ruling.firstLinePhase,
          skewAngle: ruling.skewAngle,
          lineCount: params.page.lines.length,
          pageWidth: source.pageWidth,
          pageHeight: source.pageHeight,
        }
      : null;

  /**
   * Без списка зависимостей: проба снимается на каждый рендер — метрики
   * шрифта и раскладка доезжают асинхронно, и важно последнее состояние.
   */
  useEffect(() => {
    lastProbe = probe;
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
 * Шаг строк страницы в пикселях кадра: расстояние между базовыми линиями
 * соседних строк.
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
 * Базовые линии считаются по модели рендерера: до поворота строка n стоит на
 * высоте `topOffset + fontAscent × кегль + n × шаг строк`. Блок поворачивается
 * вокруг левого верхнего угла страницы, поэтому базовая линия b пересекает
 * столбец x на высоте `b / cos θ + x × tg θ`, а линия разлиновки — на высоте
 * `фаза + k × шаг + x × tg θ`. Слагаемое вдоль строки у них общее, и попадание
 * — это расстояние от `b / cos θ` до ближайшей линии у левого края: на листе в
 * клетку строка занимает две клетки, и базовая линия садится на каждую вторую.
 *
 * @param probe — снимок параметров отрисовки и разлиновки
 * @returns отклонение в долях шага разлиновки
 */
const measureBaselineDrift = (probe: BaselineProbe): number => {
  const { topOffset, fontSizePx, fontAscent, blockRotate } = probe;
  const { step, firstLinePhase, lineCount } = probe;
  const lineStep = measureLineStep(probe);
  const stretch = 1 / Math.cos((blockRotate * Math.PI) / 180);
  let drift = 0;

  for (let index = 0; index < lineCount; index += 1) {
    const baselineY = (topOffset + fontAscent * fontSizePx + index * lineStep) * stretch;
    const lines = (baselineY - firstLinePhase) / step;

    drift = Math.max(drift, Math.abs(lines - Math.round(lines)));
  }

  return drift;
};

/**
 * Ждёт, пока страница ляжет выбранным шрифтом на нужный лист, и отдаёт снятую
 * пробу.
 *
 * Ожидание идёт по метрикам: шрифт грузится и меряется асинхронно, и до
 * замера геометрия считается по запасным пропорциям — попадание на линиях
 * такой страницы ничего не сказало бы о самом шрифте. Метрики проба сверяет с
 * замером живого щупа: так видно, что в отрисовку ушли пропорции именно этого
 * начертания. Ждёт проба и раскладку под лист страницы: до пересчёта отрисовка
 * берёт геометрию прежнего листа, а разлиновку проба снимает уже с нового.
 *
 * @param fontFamily — ожидаемое семейство шрифта страницы
 * @param pageIndex — ожидаемая страница
 * @param sheetId — ожидаемый лист; не задан — любой
 * @returns проба, снятая на метриках этого шрифта
 */
const waitForProbe = async (
  fontFamily: string,
  pageIndex = 0,
  sheetId = ''
): Promise<BaselineProbe> => {
  const metrics = await loadFontMetrics(fontFamily);

  await waitFor(
    async () => {
      await expect(lastProbe?.fontFamily).toBe(fontFamily);
      await expect(lastProbe?.pageIndex).toBe(pageIndex);
      await expect(lastProbe?.sheetId).toBe(sheetId || lastProbe?.sheetId);
      await expect(lastProbe?.layoutSheetId).toBe(lastProbe?.sheetId);
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
 * Проверяет, что базовые линии сели на разлиновку листа страницы.
 *
 * @param probe — снятая проба
 */
const expectBaselinesOnRuling = async (probe: BaselineProbe): Promise<void> => {
  /**
   * Блок наклонён ровно на угол разлиновки страницы: только при этом сдвиг
   * вдоль строки у базовой линии и у линии разлиновки один и тот же, и
   * попадание у левого края значит попадание по всей строке.
   */
  await expect(probe.blockRotate).toBeCloseTo(probe.skewAngle, 9);

  /**
   * Строка занимает не меньше линии разлиновки: сойдись шаг строк в ноль,
   * строки легли бы одна на другую, а отклонение от линий всё равно вышло бы
   * нулевым — попадание проверяется вместе с тем, что строки расходятся.
   */
  await expect(measureLineStep(probe)).toBeGreaterThanOrEqual(
    probe.step * (1 - STEP_EPSILON)
  );
  await expect(measureBaselineDrift(probe)).toBeLessThanOrEqual(DRIFT_TOLERANCE);
};

/**
 * Ставит стор в известное состояние и забывает прошлую пробу: семья листов —
 * из аргумента, всё остальное по умолчанию. Экземпляры без артефакта профилей
 * несут синтезированную разлиновку без наклона.
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

/**
 * Ставит стор на закреплённый лист пресет-пака с измерениями и на заданную
 * половину разворота.
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
    text: SPREAD_TEXT,
    familyId,
    sheetId,
    isSheetPinned: true,
    pageIndex,
  });
};

/**
 * Сколько разных шагов разлиновки у экземпляров семьи. Экземпляры пресет-пака
 * сняты с разного расстояния, поэтому число меньше числа экземпляров значит,
 * что в дело пошли листы без измерений.
 *
 * @param family — семья листов
 * @returns число разных шагов
 */
const countDistinctSteps = (family: PaperFamily): number => {
  const steps = family.sheets.reduce<Set<number>>((acc, sheet) => {
    acc.add(sheet.ruling.step);

    return acc;
  }, new Set<number>());

  return steps.size;
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
 * Строки садятся на разлиновку настоящих фотографий пресет-пака — на каждом
 * экземпляре и на обеих половинах разворота, а страница равна кадру своего
 * листа.
 *
 * Экземпляры берутся из артефакта профилей: у каждого свой шаг, поля и наклон,
 * и на чётной странице разлиновка отражена вместе с наклоном — на наклонных
 * листах потерянная при отражении поправка вывела бы строки за допуск.
 */
export const PhotoRulingOnSheet: Story = {
  play: async () => {
    const families = await loadPaperFamilies();

    for (const family of families) {
      await expect(countDistinctSteps(family)).toBe(family.sheets.length);

      for (const sheet of family.sheets) {
        for (const pageIndex of [0, 1]) {
          applySheet(families, family.id, sheet.id, pageIndex);

          const probe = await waitForProbe(DEFAULT_FONT, pageIndex, sheet.id);

          await expectBaselinesOnRuling(probe);
          await expect(probe.pageWidth).toBe(sheet.width);
          await expect(probe.pageHeight).toBe(sheet.height);
        }
      }
    }
  },
};
