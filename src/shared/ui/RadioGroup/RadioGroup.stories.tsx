import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn, userEvent } from 'storybook/test';

import { RadioGroup } from './RadioGroup';

const meta = {
  component: RadioGroup,
  args: {
    label: 'Фон листа',
    value: 'grid',
    options: [
      { value: 'grid', label: 'Тетрадный лист в клетку' },
      { value: 'lined', label: 'Тетрадный лист в линейку' },
      { value: 'blank', label: 'Чистый лист' },
    ],
    onChange: fn(),
  },
} satisfies Meta<typeof RadioGroup>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Focused: Story = {
  play: async () => {
    await userEvent.tab();
  },
};

export const Disabled: Story = {
  args: { isDisabled: true },
};
