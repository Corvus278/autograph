import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn, userEvent } from 'storybook/test';

import { Select } from './Select';

const meta = {
  component: Select,
  args: {
    label: 'Шрифт',
    value: 'Abram',
    options: [
      { value: 'Abram', label: 'Абрам' },
      { value: 'Eskal', label: 'Эскаль' },
      { value: 'Lexa', label: 'Лекса' },
    ],
    onChange: fn(),
    className: 'w-64',
  },
} satisfies Meta<typeof Select>;

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
