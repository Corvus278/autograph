import { IconButton } from '@shared/ui/IconButton';
import { Toolbar, ToolbarItem } from '@shared/ui/Toolbar';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { MemoryRouter } from 'react-router';
import { expect, fn, within } from 'storybook/test';

import { AppHeader } from './AppHeader';

const meta = {
  component: AppHeader,
  decorators: [
    (Story) => {
      return (
        <MemoryRouter initialEntries={['/']}>
          <Story />
        </MemoryRouter>
      );
    },
  ],
} satisfies Meta<typeof AppHeader>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole('link', { name: 'Свой шрифт' })).toHaveAttribute(
      'href',
      '/create-font'
    );
  },
};

export const WithActions: Story = {
  args: {
    actions: (
      <Toolbar label="История правок">
        <ToolbarItem>
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
        </ToolbarItem>

        <ToolbarItem>
          <IconButton label="Повторить" isDisabled onClick={fn()}>
            <svg aria-hidden viewBox="0 0 16 16">
              <path
                d="m11 3 3 3-3 3m3-3H6a4 4 0 0 0 0 8h3"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              />
            </svg>
          </IconButton>
        </ToolbarItem>
      </Toolbar>
    ),
  },
};
