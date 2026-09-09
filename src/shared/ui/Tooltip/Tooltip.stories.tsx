import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';

import { Button } from '../Button';

import { Tooltip } from './Tooltip';

const meta = {
  component: Tooltip,
  args: {
    content: 'Сохраняется только открытая страница',
    children: <Button onClick={fn()}>Сохранить PNG</Button>,
  },
} satisfies Meta<typeof Tooltip>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
