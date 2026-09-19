import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';

import { FileInput } from './FileInput';

const meta = {
  component: FileInput,
  args: {
    label: 'Свой шрифт (.ttf)',
    accept: '.ttf',
    onSelect: fn(),
  },
} satisfies Meta<typeof FileInput>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Focused: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.tab();

    await expect(
      within(canvasElement).getByRole('button', { name: 'Свой шрифт (.ttf)' })
    ).toHaveFocus();
  },
};

/**
 * Выбранный файл: имя стоит рядом с кнопкой и служит ей описанием.
 */
export const Selected: Story = {
  play: async ({ args, canvasElement }) => {
    const field = canvasElement.querySelector<HTMLInputElement>('input[type="file"]');
    const file = new File(['x'], 'мой-почерк.ttf', { type: 'font/ttf' });

    if (field) {
      await userEvent.upload(field, file);
    }

    await expect(within(canvasElement).getByText('мой-почерк.ttf')).toBeVisible();
    await expect(args.onSelect).toHaveBeenCalledWith(file);
  },
};

export const WithError: Story = {
  args: { error: 'Не удалось прочитать шрифт: выберите файл .ttf' },
};

export const Disabled: Story = {
  args: { isDisabled: true },
};
