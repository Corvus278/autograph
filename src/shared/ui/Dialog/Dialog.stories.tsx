import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';

import { Button } from '../Button';

import { Dialog } from './Dialog';

const meta = {
  component: Dialog,
  args: {
    isOpen: true,
    title: 'Свой лист',
    description: 'Проверьте найденную разлиновку и поля',
    trigger: <Button onClick={fn()}>Настроить лист</Button>,
    children: (
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={fn()}>
          Отмена
        </Button>

        <Button variant="primary" onClick={fn()}>
          Сохранить
        </Button>
      </div>
    ),
    onOpenChange: fn(),
  },
} satisfies Meta<typeof Dialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithoutDescription: Story = {
  args: { description: '' },
};

export const Closed: Story = {
  args: { isOpen: false },
};
