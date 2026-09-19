import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn, userEvent } from 'storybook/test';

import { TileRadio } from './TileRadio';

/**
 * Превью в story — схемы разлиновки, а не фотографии: story не зависит
 * от пресет-пака.
 */
const GRID_PREVIEW = (
  <svg aria-hidden viewBox="0 0 24 24" className="size-6 text-fg-subtle">
    <path d="M0 6h24M0 12h24M0 18h24M6 0v24M12 0v24M18 0v24" stroke="currentColor" />
  </svg>
);

const LINED_PREVIEW = (
  <svg aria-hidden viewBox="0 0 24 24" className="size-6 text-fg-subtle">
    <path d="M0 6h24M0 12h24M0 18h24" stroke="currentColor" />
  </svg>
);

const meta = {
  component: TileRadio,
  args: {
    label: 'Бумага',
    value: 'grid',
    options: [
      { value: 'grid', label: 'Клетка', preview: GRID_PREVIEW },
      { value: 'lined', label: 'Линейка', preview: LINED_PREVIEW },
    ],
    onChange: fn(),
  },
} satisfies Meta<typeof TileRadio>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithoutPreview: Story = {
  args: {
    options: [
      { value: 'grid', label: 'Клетка' },
      { value: 'lined', label: 'Линейка' },
    ],
  },
};

export const Focused: Story = {
  play: async () => {
    await userEvent.tab();
  },
};
