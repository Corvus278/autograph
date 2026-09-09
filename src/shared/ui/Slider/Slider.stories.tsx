import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn, userEvent } from 'storybook/test';

import { Slider } from './Slider';

const meta = {
  component: Slider,
  args: {
    label: 'Размер шрифта',
    value: 1.6,
    min: 0.1,
    max: 10,
    step: 0.1,
    onChange: fn(),
    className: 'w-64',
  },
} satisfies Meta<typeof Slider>;

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
