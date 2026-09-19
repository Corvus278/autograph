import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn, userEvent } from 'storybook/test';

import { IconButton } from './IconButton';

const meta = {
  component: IconButton,
  args: {
    label: 'Отменить',
    onClick: fn(),
    children: (
      <svg aria-hidden viewBox="0 0 16 16">
        <path
          d="M5 3 2 6l3 3M2 6h8a4 4 0 0 1 0 8H7"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      </svg>
    ),
  },
} satisfies Meta<typeof IconButton>;

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
