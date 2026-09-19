import type { Meta, StoryObj } from '@storybook/react-vite';

import { Label } from './Label';

const meta = {
  component: Label,
  args: {
    htmlFor: 'text',
    children: 'Текст письма',
  },
  render: (args) => {
    return (
      <div className="flex flex-col gap-1.5">
        <Label {...args} />

        <input
          id="text"
          className="rounded-md border border-border-strong bg-surface-raised px-3 py-2 text-sm text-fg"
        />
      </div>
    );
  },
} satisfies Meta<typeof Label>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
