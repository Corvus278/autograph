/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen } from '@testing-library/react';
import { AppHeader } from '@widgets/AppHeader';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { appVersion } = vi.hoisted(() => {
  return { appVersion: { value: '' } };
});

vi.mock('@shared/config', () => {
  return {
    get APP_VERSION() {
      return appVersion.value;
    },
  };
});

const renderHeader = () => {
  render(
    <MemoryRouter>
      <AppHeader actions={null} />
    </MemoryRouter>
  );
};

afterEach(() => {
  cleanup();
  appVersion.value = '';
});

describe('версия в шапке', () => {
  it('показывает версию с пометкой beta рядом с названием', () => {
    appVersion.value = '0.1.42';

    renderHeader();

    expect(screen.getByTestId('app-version').textContent).toBe('v0.1.42 beta');
  });

  /**
   * Имя ссылки — только название: номер версии в нём читалка произносила бы
   * при каждом переходе на генератор, хотя ведёт ссылка не на версию.
   */
  it('не добавляет версию в имя ссылки на генератор', () => {
    appVersion.value = '0.1.42';

    renderHeader();

    expect(screen.getByRole('link', { name: 'Autograph' })).toBeDefined();
  });

  /**
   * Пустая версия — запуск без сборки: dev-сервер и тесты. Рисовать там
   * нечего, и пустая подпись занимала бы место рядом с названием.
   */
  it('молчит, когда версии нет', () => {
    renderHeader();

    expect(screen.queryByTestId('app-version')).toBeNull();
  });
});
