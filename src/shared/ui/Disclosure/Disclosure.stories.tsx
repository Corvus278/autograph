import type { Meta, StoryObj } from '@storybook/react-vite';

import { Disclosure } from './Disclosure';

const meta = {
  component: Disclosure,
  args: {
    title: 'Экспертный режим',
    children: <p className="text-sm text-fg-muted">Поправка геометрии и искажения</p>,
    className: 'w-80',
  },
} satisfies Meta<typeof Disclosure>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Open: Story = {
  args: { isDefaultOpen: true },
};
