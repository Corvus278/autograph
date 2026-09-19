import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn, userEvent } from 'storybook/test';

import { IconButton } from '../IconButton';

import { Toolbar } from './Toolbar';
import { ToolbarItem } from './ToolbarItem';

const meta = {
  component: Toolbar,
  args: {
    label: 'История правок',
    children: [
      <ToolbarItem key="undo">
        <IconButton label="Отменить" onClick={fn()}>
          <svg aria-hidden viewBox="0 0 16 16">
            <path
              d="M5 3 2 6l3 3M2 6h8a4 4 0 0 1 0 8H7"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            />
          </svg>
        </IconButton>
      </ToolbarItem>,
      <ToolbarItem key="redo">
        <IconButton label="Повторить" onClick={fn()}>
          <svg aria-hidden viewBox="0 0 16 16">
            <path
              d="m11 3 3 3-3 3m3-3H6a4 4 0 0 0 0 8h3"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            />
          </svg>
        </IconButton>
      </ToolbarItem>,
    ],
  },
} satisfies Meta<typeof Toolbar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Focused: Story = {
  play: async () => {
    await userEvent.tab();
    await userEvent.keyboard('{ArrowRight}');
  },
};
