/**
 * @vitest-environment jsdom
 */
import {
  DEFAULT_GENERATOR_STATE,
  useGeneratorStore,
} from '@pages/Generator/model/useGeneratorStore';
import { SettingsPanel } from '@pages/Generator/ui/Generator/SettingsPanel';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

/**
 * Разворачивает группу настроек: по умолчанию открыта только первая.
 */
const openSection = async (user: ReturnType<typeof userEvent.setup>, title: string) => {
  await user.click(screen.getByRole('button', { name: title }));
};

beforeEach(() => {
  useGeneratorStore.setState(DEFAULT_GENERATOR_STATE);
});

afterEach(() => {
  cleanup();
});

describe('группа «Текст и шрифт»', () => {
  it('меняет текст в сторе', async () => {
    const user = userEvent.setup();

    render(<SettingsPanel />);

    const field = screen.getByRole('textbox', { name: 'Текст' });

    await user.clear(field);
    await user.type(field, 'привет');

    expect(store().text).toBe('привет');
  });

  it('подключает свой шрифт и позволяет вернуться к списку', async () => {
    const user = userEvent.setup();

    render(<SettingsPanel />);

    await user.upload(screen.getByLabelText('Свой шрифт (.ttf)'), buildFontFile());

    await waitFor(() => {
      expect(store().customFontFamily).toBe('UserFont');
    });

    await user.click(screen.getByRole('button', { name: 'Вернуть из списка' }));

    expect(store().customFontFamily).toBeNull();
  });

  it('показывает ошибку на нечитаемом файле и не меняет шрифт', async () => {
    const user = userEvent.setup();

    render(<SettingsPanel />);

    await user.upload(screen.getByLabelText('Свой шрифт (.ttf)'), buildBrokenFontFile());

    await waitFor(() => {
      expect(
        screen.getByText('Не удалось прочитать шрифт. Нужен файл .ttf')
      ).toBeDefined();
    });

    expect(store().customFontFamily).toBeNull();
  });

  it('меняет цвет чернил', async () => {
    render(<SettingsPanel />);

    const control = screen.getByLabelText('Цвет чернил');

    expect(control.getAttribute('value')).toBe(DEFAULT_GENERATOR_STATE.inkColor);
  });
});

describe('группа «Геометрия»', () => {
  it('слайдер меняет значение в сторе и подпись рядом с контролом', async () => {
    const user = userEvent.setup();

    render(<SettingsPanel />);
    await openSection(user, 'Геометрия');

    const slider = screen.getByRole('slider', { name: 'Ширина блока' });

    slider.focus();
    await user.keyboard('{ArrowRight}');

    expect(store().blockWidth).toBe(DEFAULT_GENERATOR_STATE.blockWidth + 1);
    expect(
      screen.getByText(String(DEFAULT_GENERATOR_STATE.blockWidth + 1))
    ).toBeDefined();
  });
});

describe('группа «Фон»', () => {
  it('загрузка своего фона сбрасывает выбор встроенного', async () => {
    const user = userEvent.setup();

    render(<SettingsPanel />);
    await openSection(user, 'Фон');

    await user.upload(
      screen.getByLabelText('Свой фон'),
      new File([new Uint8Array([1, 2, 3])], 'bg.png', { type: 'image/png' })
    );

    await waitFor(() => {
      expect(store().customBackgroundSrc).not.toBeNull();
    });

    expect(
      screen
        .getByRole('radio', { name: 'Тетрадный лист в клетку' })
        .getAttribute('data-state')
    ).toBe('unchecked');
  });

  it('включает режим «убрать фон»', async () => {
    const user = userEvent.setup();

    render(<SettingsPanel />);
    await openSection(user, 'Фон');

    await user.click(screen.getByRole('checkbox', { name: 'Убрать фон' }));

    expect(store().isBackgroundHidden).toBe(true);
  });
});

describe('группа «Модификации почерка»', () => {
  it('переключатель меняет соответствующий флаг', async () => {
    const user = userEvent.setup();

    render(<SettingsPanel />);
    await openSection(user, 'Модификации почерка');

    await user.click(screen.getByRole('checkbox', { name: 'Съезд линий' }));

    expect(store().flags.isLineRotated).toBe(true);
    expect(store().flags.isWordRotated).toBe(false);
  });

  it('«Перегенерировать» меняет seed', async () => {
    const user = userEvent.setup();

    render(<SettingsPanel />);
    await openSection(user, 'Модификации почерка');

    const before = store().seed;

    await user.click(screen.getByRole('button', { name: 'Перегенерировать' }));

    expect(store().seed).not.toBe(before);
  });
});

describe('группа «Сцена для сохранения»', () => {
  it('при выключенном режиме контролы сцены недоступны', async () => {
    const user = userEvent.setup();

    render(<SettingsPanel />);
    await openSection(user, 'Сцена для сохранения');

    expect(
      screen.getByRole('radio', { name: 'Стол' }).getAttribute('data-disabled')
    ).not.toBeNull();
    expect(screen.getByLabelText('Своя сцена').hasAttribute('disabled')).toBe(true);
    expect(
      screen
        .getByRole('checkbox', { name: 'Тень под страницей' })
        .hasAttribute('disabled')
    ).toBe(true);
  });

  it('после включения режима контролы сцены доступны', async () => {
    const user = userEvent.setup();

    render(<SettingsPanel />);
    await openSection(user, 'Сцена для сохранения');

    await user.click(
      screen.getByRole('checkbox', { name: 'Вкладывать страницу в сцену' })
    );

    expect(store().isSceneEnabled).toBe(true);
    expect(screen.getByLabelText('Своя сцена').hasAttribute('disabled')).toBe(false);
  });
});

describe('панель настроек', () => {
  it('сворачивает группу, не трогая параметры', async () => {
    const user = userEvent.setup();

    render(<SettingsPanel />);

    expect(screen.getByRole('textbox', { name: 'Текст' })).toBeDefined();

    await user.click(screen.getByRole('button', { name: 'Текст и шрифт' }));

    await waitFor(() => {
      expect(screen.queryByRole('textbox', { name: 'Текст' })).toBeNull();
    });

    expect(store().text).toBe(DEFAULT_GENERATOR_STATE.text);
  });
});
