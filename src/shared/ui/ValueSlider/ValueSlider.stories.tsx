import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn, userEvent } from 'storybook/test';

import { ValueSlider } from './ValueSlider';

/**
 * Форматтер для story: единица настоящая, но код генератора `shared` не
 * импортирует.
 */
const formatDegrees = (value: number): string => {
  return `${value}°`;
};

const meta = {
  component: ValueSlider,
  args: {
    label: 'Поворот',
    value: 3,
    min: -10,
    max: 10,
    step: 1,
    formatValue: formatDegrees,
    onChange: fn(),
    onValueCommit: fn(),
    className: 'w-64',
  },
} satisfies Meta<typeof ValueSlider>;

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
