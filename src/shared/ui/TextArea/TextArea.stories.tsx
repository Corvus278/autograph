import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn, userEvent } from 'storybook/test';

import { TextArea } from './TextArea';

const meta = {
  component: TextArea,
  args: {
    label: 'Текст',
    value: 'Здравствуй!',
    onChange: fn(),
    className: 'w-80',
  },
} satisfies Meta<typeof TextArea>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: { value: '' },
};

export const Focused: Story = {
  play: async () => {
    await userEvent.tab();
  },
};
