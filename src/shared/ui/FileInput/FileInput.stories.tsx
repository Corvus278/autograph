import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn, userEvent } from 'storybook/test';

import { FileInput } from './FileInput';

const meta = {
  component: FileInput,
  args: {
    label: 'Свой шрифт (.ttf)',
    accept: '.ttf',
    onSelect: fn(),
  },
} satisfies Meta<typeof FileInput>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Focused: Story = {
  play: async () => {
    await userEvent.tab();
  },
};

export const WithError: Story = {
  args: { error: 'Не удалось прочитать шрифт: выберите файл .ttf' },
};

export const Disabled: Story = {
  args: { isDisabled: true },
};
