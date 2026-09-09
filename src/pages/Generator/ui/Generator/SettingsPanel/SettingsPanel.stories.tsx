import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';

import {
  DEFAULT_GENERATOR_STATE,
  useGeneratorStore,
} from '../../../model/useGeneratorStore';

import { SettingsPanel } from './SettingsPanel';

const ALL_SECTIONS = ['text', 'geometry', 'background', 'distortions', 'scene'];

const meta = {
  component: SettingsPanel,
  beforeEach: () => {
    useGeneratorStore.setState(DEFAULT_GENERATOR_STATE);
  },
} satisfies Meta<typeof SettingsPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const AllSectionsOpen: Story = {
  args: { defaultOpenSections: ALL_SECTIONS },
};

export const AllSectionsCollapsed: Story = {
  args: { defaultOpenSections: [] },
};

export const SceneEnabled: Story = {
  args: { defaultOpenSections: ['scene'] },
  beforeEach: () => {
    useGeneratorStore.setState({ ...DEFAULT_GENERATOR_STATE, isSceneEnabled: true });
  },
};

export const SceneDisabled: Story = {
  args: { defaultOpenSections: ['scene'] },
};

export const BrokenFontFile: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const brokenFont = new File(['совсем не шрифт'], 'font.ttf');

    await userEvent.upload(canvas.getByLabelText('Свой шрифт (.ttf)'), brokenFont);
    await expect(
      await canvas.findByText('Не удалось прочитать шрифт. Нужен файл .ttf')
    ).toBeInTheDocument();
  },
};
