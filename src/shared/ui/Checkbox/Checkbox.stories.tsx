import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn, userEvent } from 'storybook/test';

import { Checkbox } from './Checkbox';

const meta = {
  component: Checkbox,
  args: {
    label: 'Съезд линий',
    isChecked: false,
    onChange: fn(),
  },
} satisfies Meta<typeof Checkbox>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Unchecked: Story = {};

export const Checked: Story = {
  args: { isChecked: true },
};

export const Focused: Story = {
  play: async () => {
    await userEvent.tab();
  },
};

export const Disabled: Story = {
  args: { isDisabled: true },
};
