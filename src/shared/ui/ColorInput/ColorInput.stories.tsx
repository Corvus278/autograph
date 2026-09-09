import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn, userEvent } from 'storybook/test';

import { ColorInput } from './ColorInput';

const meta = {
  component: ColorInput,
  args: {
    label: 'Цвет чернил',
    value: '#222222',
    onChange: fn(),
    className: 'w-64',
  },
} satisfies Meta<typeof ColorInput>;

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
