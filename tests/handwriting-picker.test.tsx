/**
 * @vitest-environment jsdom
 */
import { HANDWRITING_FONTS } from '@pages/Generator/config';
import {
  DEFAULT_GENERATOR_STATE,
  useGeneratorStore,
} from '@pages/Generator/model/useGeneratorStore';
import { HandwritingPicker } from '@pages/Generator/ui/Generator/SettingsPane/HandwritingPicker';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

/**
 * Настоящий `.ttf` начинается с версии sfnt `00 01 00 00`; заглушка FontFace в
 * тестовом окружении разбирает файл по первому байту.
 */
const buildFontFile = (): File => {
  return new File([new Uint8Array([0, 1, 0, 0])], 'font.ttf');
};

/**
 * Имя с расширением `.ttf` обязательно: браузер (и `user.upload`) не отдаёт
 * контролу файл, который не подходит под `accept`, — до разбора дело не дойдёт.
 */
const buildBrokenFontFile = (): File => {
  return new File(['совсем не шрифт'], 'font.ttf');
};

const store = () => {
  return useGeneratorStore.getState();
};

const renderPicker = () => {
  return render(
    <MemoryRouter>
      <HandwritingPicker />
    </MemoryRouter>
  );
};

beforeEach(() => {
  useGeneratorStore.setState(DEFAULT_GENERATOR_STATE);
});

afterEach(() => {
  cleanup();
});

describe('HandwritingPicker', () => {
  it('пишет название каждого почерка его же шрифтом', async () => {
    const user = userEvent.setup();

    renderPicker();

    await user.click(screen.getByRole('combobox', { name: 'Почерк' }));

    for (const { family, label } of HANDWRITING_FONTS) {
      const option = screen.getByRole('option', { name: label });

      expect(option.style.fontFamily).toBe(family);
    }
  });

  it('меняет почерк выбором из списка', async () => {
    const user = userEvent.setup();

    renderPicker();

    await user.click(screen.getByRole('combobox', { name: 'Почерк' }));
    await user.click(screen.getByRole('option', { name: 'Лекса' }));

    expect(store().fontFamily).toBe('Lexa');
  });

  it('подключает свой шрифт, а выбор из списка возвращает встроенный', async () => {
    const user = userEvent.setup();

    renderPicker();

    await user.upload(screen.getByLabelText('Свой шрифт (.ttf)'), buildFontFile());

    await waitFor(() => {
      expect(store().customFontFamily).toBe('UserFont');
    });

    await user.click(screen.getByRole('combobox', { name: 'Почерк' }));
    await user.click(screen.getByRole('option', { name: 'Лекса' }));

    expect(store().customFontFamily).toBeNull();
    expect(store().fontFamily).toBe('Lexa');
  });

  it('показывает ошибку на нечитаемом файле и не меняет почерк', async () => {
    const user = userEvent.setup();
    const { fontFamily } = store();

    renderPicker();

    await user.upload(screen.getByLabelText('Свой шрифт (.ttf)'), buildBrokenFontFile());

    await waitFor(() => {
      expect(
        screen.getByText('Не удалось прочитать шрифт. Нужен файл .ttf')
      ).toBeDefined();
    });

    expect(store().customFontFamily).toBeNull();
    expect(store().fontFamily).toBe(fontFamily);
  });

  it('ведёт на инструкцию «Как создать свой шрифт»', () => {
    renderPicker();

    expect(
      screen.getByRole('link', { name: 'Как создать свой шрифт' }).getAttribute('href')
    ).toBe('/create-font');
  });
});
