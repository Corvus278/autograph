import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn, userEvent } from 'storybook/test';

import { SegmentedControl } from './SegmentedControl';

const meta = {
  component: SegmentedControl,
  args: {
    label: 'Реализм',
    value: 'normal',
    options: [
      { value: 'even', label: 'Ровно' },
      { value: 'neat', label: 'Аккуратно' },
      { value: 'normal', label: 'Обычно' },
      { value: 'sloppy', label: 'Небрежно' },
    ],
    onChange: fn(),
    className: 'w-80',
  },
} satisfies Meta<typeof SegmentedControl>;

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
