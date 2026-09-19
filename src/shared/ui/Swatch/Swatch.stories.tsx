import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn, userEvent } from 'storybook/test';

import { Swatch } from './Swatch';
import { SwatchGroup } from './SwatchGroup';

const meta = {
  component: SwatchGroup,
  args: {
    label: 'Чернила',
    value: 'blue',
    onChange: fn(),
    children: [
      <Swatch key="blue" value="blue" label="Синие" color="#1c3f94" />,
      <Swatch key="violet" value="violet" label="Фиолетовые" color="#3b2a8c" />,
      <Swatch key="black" value="black" label="Чёрные" color="#1a1a1a" />,
    ],
  },
} satisfies Meta<typeof SwatchGroup>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Focused: Story = {
  play: async () => {
    await userEvent.tab();
  },
};
