/**
 * @vitest-environment jsdom
 */
import { App } from '@app/App';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

/**
 * Маршрут задаётся адресом окна: `BrowserRouter` читает его при монтировании.
 */
const renderAt = (path: string) => {
  window.history.pushState({}, '', path);
  render(<App />);
};

afterEach(() => {
  cleanup();
});

describe('маршруты', () => {
  it('на корневом адресе показывает генератор', async () => {
    renderAt('/');

    await waitFor(() => {
      expect(screen.getByTestId('page')).toBeDefined();
    });

    expect(screen.getByRole('textbox', { name: 'Текст' })).toBeDefined();
  });

  it('на /create-font показывает инструкцию со ссылкой на генератор', () => {
    renderAt('/create-font');

    expect(
      screen.getByRole('heading', { name: 'Как создать шрифт онлайн' })
    ).toBeDefined();
    expect(screen.getByRole('link', { name: 'Вернуться к генератору' })).toBeDefined();
  });

  it('на неизвестном адресе показывает «не найдено» со ссылкой на генератор', () => {
    renderAt('/нет-такой-страницы');

    expect(screen.getByRole('heading', { name: 'Страница не найдена' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Открыть генератор' })).toBeDefined();
  });

  it.each(['/', '/create-font', '/нет-такой-страницы'])(
    'на %s показывает общую шапку с названием и переходами',
    (path) => {
      renderAt(path);

      const header = within(screen.getByRole('banner'));

      expect(header.getByRole('link', { name: 'Autograph' }).getAttribute('href')).toBe(
        '/'
      );
      expect(header.getByRole('link', { name: 'Свой шрифт' }).getAttribute('href')).toBe(
        '/create-font'
      );
    }
  );

  it('из «не найдено» пункт шапки о своём шрифте открывает инструкцию с той же шапкой', async () => {
    const user = userEvent.setup();

    renderAt('/нет-такой-страницы');

    await user.click(
      within(screen.getByRole('banner')).getByRole('link', { name: 'Свой шрифт' })
    );

    expect(
      screen.getByRole('heading', { name: 'Как создать шрифт онлайн' })
    ).toBeDefined();
    expect(
      within(screen.getByRole('banner')).getByRole('link', { name: 'Autograph' })
    ).toBeDefined();
  });

  it('из генератора пункт шапки о своём шрифте открывает инструкцию', async () => {
    const user = userEvent.setup();

    renderAt('/');

    await user.click(
      within(screen.getByRole('banner')).getByRole('link', { name: 'Свой шрифт' })
    );

    expect(
      screen.getByRole('heading', { name: 'Как создать шрифт онлайн' })
    ).toBeDefined();
  });

  it('из инструкции название в шапке ведёт на генератор', async () => {
    const user = userEvent.setup();

    renderAt('/create-font');

    await user.click(
      within(screen.getByRole('banner')).getByRole('link', { name: 'Autograph' })
    );

    await waitFor(() => {
      expect(screen.getByTestId('page')).toBeDefined();
    });
  });
});
