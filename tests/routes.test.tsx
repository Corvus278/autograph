/**
 * @vitest-environment jsdom
 */
import { App } from '@app/App';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
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
});
