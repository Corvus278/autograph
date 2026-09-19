import type { Meta, StoryObj } from '@storybook/react-vite';
import type { FC } from 'react';
import { expect, waitFor, within } from 'storybook/test';

import { GRID_FAMILY_ID, LINED_FAMILY_ID } from '../../../config';
import type { Page } from '../../../lib/paginate/paginate.types';
import type { DistortionFlags } from '../../../lib/randomize/randomize.types';
import type { Line } from '../../../lib/split/splitParagraphs.types';
import type { GeneratorRealism } from '../../../model/generator.types';
import { loadPaperFamilies } from '../../../model/paperProfiles';
import {
  DEFAULT_GENERATOR_STATE,
  useGeneratorStore,
} from '../../../model/useGeneratorStore';
import { usePageRender } from '../../../model/usePageRender';

import { PagePreview } from './PagePreview';

type PagePreviewStoryProps = {
  /**
   * Страница с готовой раскладкой: измерять в story нечего, строки заданы
   * руками.
   */
  page: Page;
};

/**
 * Источник отрисовки собирается из стора, поэтому story задаёт только строки
 * страницы, а лист, шрифт и искажения ставит в сторе. Листа раскладки у
 * страницы нет — источник берёт лист из раздачи прогона.
 *
 * Раскладка — две одинаковые страницы: номер за концом раскладки показывает
 * первую, и story чётной страницы без второй рисовала бы нечётную.
 */
const PagePreviewStory: FC<PagePreviewStoryProps> = (props) => {
  const { page } = props;
  const layoutPage = { ...page, sheetId: '' };
  const source = usePageRender([layoutPage, layoutPage]);

  return <PagePreview source={source} />;
};

/**
 * Seed фиксирован: иначе каждый прогон давал бы другой рисунок почерка и
 * скриншотные эталоны не сошлись бы.
 */
const SEED = 42;

/**
 * Реализм stories: ровное письмо с вариативностью контуров. Искажения story
 * включает сама, по одному, — со ступенью по умолчанию они шли бы все сразу.
 */
const STORY_REALISM: GeneratorRealism = {
  level: 'custom',
  flags: {
    isWordRotated: false,
    isWordSkewed: false,
    isWordShifted: false,
    isLetterSpacingRandom: false,
    isLetterFontRandom: false,
    isLineRotated: false,
    isLineShifted: false,
  },
  wordFrequency: 1,
  letterFrequency: 1,
  hasContourVariance: true,
};

/**
 * Экземпляры с самым заметным наклоном разлиновки в пресет-паке: на них видно,
 * что блок текста выкладывается вдоль наклона фотографии, а не поперёк него.
 */
const TILTED_GRID_SHEET_ID = `${GRID_FAMILY_ID}-4`;
const TILTED_LINED_SHEET_ID = `${LINED_FAMILY_ID}-1`;

const buildLines = (texts: string[]): Line[] => {
  return texts.map((text) => {
    return { text, paragraphIndex: 0 };
  });
};

const SHORT_TEXT = buildLines([
  'Здравствуй, дорогой друг!',
  '',
  'Это рукописный текст, набранный на компьютере',
  'и притворяющийся живым почерком.',
]);

/**
 * Ставит стор в известное состояние на измеренном пресет-паке.
 *
 * Экземпляры берутся с посчитанными скриптом сборки характеристиками — с
 * наклоном, полем освещения и картой текстуры: без них story рисовала бы лист
 * по синтезированной разлиновке, а не по измеренной на фотографии, и
 * canvas-путь остался бы непроверенным.
 *
 * @param flags — включённые виды искажений почерка
 * @param patch — что ещё поменять в состоянии генератора
 */
const applyState = async (
  flags: Partial<DistortionFlags> = {},
  patch: Partial<typeof DEFAULT_GENERATOR_STATE> = {}
): Promise<void> => {
  const presetFamilies = await loadPaperFamilies();

  useGeneratorStore.setState({
    ...DEFAULT_GENERATOR_STATE,
    presetFamilies,
    runSeed: SEED,
    realism: { ...STORY_REALISM, flags: { ...STORY_REALISM.flags, ...flags } },
    ...patch,
  });
};

/**
 * Закрепляет экземпляр листа за прогоном — так же, как это делает выбор в
 * панели. Без закрепления лист странице выдаёт рецепт прогона, и story
 * показывала бы не тот экземпляр, о котором она заведена.
 *
 * @param familyId — семья листов
 * @param sheetId — экземпляр внутри семьи
 * @returns патч состояния генератора
 */
const pinSheet = (
  familyId: string,
  sheetId: string
): Partial<typeof DEFAULT_GENERATOR_STATE> => {
  return { familyId, sheetId, isSheetPinned: true };
};

/**
 * Что нарисовано на канве страницы.
 */
type CanvasInk = {
  /**
   * Доля непрозрачных пикселей от всей канвы.
   */
  drawnShare: number;

  /**
   * Число различных цветов среди непрозрачных пикселей.
   */
  colorCount: number;
};

/**
 * Считает, что нарисовано на канве страницы.
 *
 * Считается по растру, а не на глаз: пустая канва даёт нули, залитая одним
 * цветом — один цвет, и оба случая означают, что рендерер до листа не дошёл.
 *
 * @param canvas — канва предпросмотра
 * @returns доля закрашенного и число различных цветов
 */
const measureCanvasInk = (canvas: HTMLCanvasElement): CanvasInk => {
  const context = canvas.getContext('2d');

  if (!context || canvas.width === 0 || canvas.height === 0) {
    return { drawnShare: 0, colorCount: 0 };
  }

  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  const colors = new Set<number>();
  let drawn = 0;

  for (let offset = 0; offset < data.length; offset += 4) {
    const alpha = data[offset + 3] || 0;

    if (alpha > 0) {
      drawn += 1;
      colors.add(
        ((data[offset] || 0) << 24) |
          ((data[offset + 1] || 0) << 16) |
          ((data[offset + 2] || 0) << 8) |
          alpha
      );
    }
  }

  return { drawnShare: drawn / (canvas.width * canvas.height), colorCount: colors.size };
};

/**
 * Канва предпросмотра. Другого узла у страницы нет: интерфейс живёт вне неё.
 *
 * @param canvasElement — корневой узел story
 * @returns канва страницы
 */
const findPageCanvas = async (canvasElement: HTMLElement): Promise<HTMLCanvasElement> => {
  const canvas = await within(canvasElement).findByTestId('page-canvas');

  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error('Предпросмотр рисует не на canvas');
  }

  return canvas;
};

/**
 * Проверка, общая для всех stories предпросмотра: страница дорисовалась.
 *
 * Фотография листа, контуры шрифта и карта текстуры грузятся по сети, поэтому
 * первый кадр приходит пустым — проверка ждёт, пока на канве появится растр.
 *
 * @param canvasElement — корневой узел story
 */
const expectPageDrawn = async (canvasElement: HTMLElement): Promise<void> => {
  const canvas = await findPageCanvas(canvasElement);

  await waitFor(async () => {
    const { drawnShare, colorCount } = measureCanvasInk(canvas);

    await expect(drawnShare).toBeGreaterThan(0);
    await expect(colorCount).toBeGreaterThan(4);
  });
};

const meta = {
  component: PagePreviewStory,
  parameters: {
    /**
     * Проверка контраста здесь не к месту: на листе не интерфейсный текст, а
     * результат работы генератора — цвет чернил задаёт пользователь, а фон
     * листа бывает и убран совсем.
     */
    a11y: { config: { rules: [{ id: 'color-contrast', enabled: false }] } },
  },
  args: {
    page: { lines: SHORT_TEXT },
  },
  beforeEach: async () => {
    await applyState();
  },
  play: async ({ canvasElement }) => {
    await expectPageDrawn(canvasElement);
  },
} satisfies Meta<typeof PagePreviewStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const GridBackground: Story = {
  beforeEach: async () => {
    await applyState({}, pinSheet(GRID_FAMILY_ID, `${GRID_FAMILY_ID}-1`));
  },
};

export const LinedBackground: Story = {
  beforeEach: async () => {
    await applyState({}, pinSheet(LINED_FAMILY_ID, `${LINED_FAMILY_ID}-2`));
  },
};

/**
 * Фотография снята с заметным перекосом: блок текста наклоняется на угол
 * разлиновки экземпляра, а не выправляет фотографию.
 */
export const TiltedGridSheet: Story = {
  beforeEach: async () => {
    await applyState({}, pinSheet(GRID_FAMILY_ID, TILTED_GRID_SHEET_ID));
  },
};

export const TiltedLinedSheet: Story = {
  beforeEach: async () => {
    await applyState({}, pinSheet(LINED_FAMILY_ID, TILTED_LINED_SHEET_ID));
  },
};

export const WithoutBackground: Story = {
  beforeEach: async () => {
    await applyState({}, { isBackgroundHidden: true });
  },
};

/**
 * Правая половина разворота: фотография отражается, блок отступает от
 * отражённой линии поля. Экземпляр не закреплён — его выдаёт рецепт прогона,
 * и на второй странице это уже другой лист.
 */
export const EvenPage: Story = {
  beforeEach: async () => {
    await applyState({}, { pageIndex: 1 });
  },
};

export const ManyLines: Story = {
  args: {
    page: {
      lines: buildLines(
        Array.from({ length: 30 }, (_item, index) => {
          return `Строка номер ${index + 1} на длинной странице`;
        })
      ),
    },
  },
};

/**
 * Вариативность контуров включена: одинаковые буквы расходятся по форме.
 * Парная к ней story рисует те же слова исходными контурами шрифта.
 */
export const ContourVariance: Story = {
  beforeEach: async () => {
    await applyState({}, { realism: { ...STORY_REALISM, hasContourVariance: true } });
  },
};

export const WithoutContourVariance: Story = {
  beforeEach: async () => {
    await applyState({}, { realism: { ...STORY_REALISM, hasContourVariance: false } });
  },
};

export const WordRotated: Story = {
  beforeEach: async () => {
    await applyState({ isWordRotated: true });
  },
};

export const WordSkewed: Story = {
  beforeEach: async () => {
    await applyState({ isWordSkewed: true });
  },
};

export const WordShifted: Story = {
  beforeEach: async () => {
    await applyState({ isWordShifted: true });
  },
};

export const LetterSpacingRandom: Story = {
  beforeEach: async () => {
    await applyState({ isLetterSpacingRandom: true });
  },
};

export const LetterFontRandom: Story = {
  beforeEach: async () => {
    await applyState({ isLetterFontRandom: true });
  },
};

export const LineRotated: Story = {
  beforeEach: async () => {
    await applyState({ isLineRotated: true });
  },
};

export const LineShifted: Story = {
  beforeEach: async () => {
    await applyState({ isLineShifted: true });
  },
};

export const AllDistortions: Story = {
  beforeEach: async () => {
    await applyState({
      isWordRotated: true,
      isWordSkewed: true,
      isWordShifted: true,
      isLetterSpacingRandom: true,
      isLetterFontRandom: true,
      isLineRotated: true,
      isLineShifted: true,
    });
  },
};
