import type { Meta, StoryObj } from '@storybook/react-vite';
import type { FC } from 'react';
import { useRef } from 'react';

import { PAGE_BACKGROUNDS, PAGE_WIDTH } from '../../../config';
import type { DistortionFlags } from '../../../lib/randomize/randomize.types';
import type { Line } from '../../../lib/split/splitParagraphs.types';
import {
  DEFAULT_GENERATOR_STATE,
  useGeneratorStore,
} from '../../../model/useGeneratorStore';
import type { PageBackgroundView } from '../../../model/usePageBackground.types';

import { PagePreview } from './PagePreview';
import type { PagePreviewProps } from './PagePreview.types';

type PagePreviewStoryProps = Omit<PagePreviewProps, 'pageRef'>;

/**
 * Своя ссылка на узел страницы у каждой story: держать её в `args` нельзя —
 * после первого рендера в ней лежит DOM-узел, и Storybook уходит в бесконечный
 * обход при сравнении аргументов.
 */
const PagePreviewStory: FC<PagePreviewStoryProps> = (props) => {
  const { page, background } = props;
  const pageRef = useRef<HTMLDivElement>(null);

  return <PagePreview pageRef={pageRef} page={page} background={background} />;
};

/**
 * Seed фиксирован: иначе каждый прогон давал бы другой рисунок почерка и
 * скриншотные эталоны не сошлись бы.
 */
const SEED = 42;

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

const buildBackground = (backgroundId: string): PageBackgroundView => {
  const background =
    PAGE_BACKGROUNDS.find(({ id }) => {
      return id === backgroundId;
    }) ?? PAGE_BACKGROUNDS[0];

  if (!background) {
    return { src: null, width: PAGE_WIDTH, height: null };
  }

  return {
    src: background.src,
    width: PAGE_WIDTH,
    height: Math.round((PAGE_WIDTH * background.height) / background.width),
  };
};

/**
 * Ставит стор в известное состояние: искажения задаются флагами, всё
 * остальное — значения по умолчанию.
 */
const applyFlags = (flags: Partial<DistortionFlags>) => {
  useGeneratorStore.setState({
    ...DEFAULT_GENERATOR_STATE,
    seed: SEED,
    flags: { ...DEFAULT_GENERATOR_STATE.flags, ...flags },
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
    background: buildBackground('grid'),
  },
  beforeEach: () => {
    applyFlags({});
  },
} satisfies Meta<typeof PagePreviewStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const GridBackground: Story = {};

export const LinedBackground: Story = {
  args: { background: buildBackground('lined') },
};

export const BlankBackground: Story = {
  args: { background: buildBackground('blank') },
};

export const WithoutBackground: Story = {
  args: { background: { src: null, width: PAGE_WIDTH, height: null } },
};

export const EvenPage: Story = {
  beforeEach: () => {
    applyFlags({});
    useGeneratorStore.setState({ pageIndex: 1 });
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

export const WordRotated: Story = {
  beforeEach: () => {
    applyFlags({ isWordRotated: true });
  },
};

export const WordSkewed: Story = {
  beforeEach: () => {
    applyFlags({ isWordSkewed: true });
  },
};

export const WordShifted: Story = {
  beforeEach: () => {
    applyFlags({ isWordShifted: true });
  },
};

export const LetterSpacingRandom: Story = {
  beforeEach: () => {
    applyFlags({ isLetterSpacingRandom: true });
  },
};

export const LetterFontRandom: Story = {
  beforeEach: () => {
    applyFlags({ isLetterFontRandom: true });
  },
};

export const LineRotated: Story = {
  beforeEach: () => {
    applyFlags({ isLineRotated: true });
  },
};

export const LineShifted: Story = {
  beforeEach: () => {
    applyFlags({ isLineShifted: true });
  },
};

export const AllDistortions: Story = {
  beforeEach: () => {
    applyFlags({
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
