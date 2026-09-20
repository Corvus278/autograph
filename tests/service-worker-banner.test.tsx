/**
 * @vitest-environment jsdom
 */
import { App } from '@app/App';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { RegisterServiceWorkerOptions } from '@widgets/ServiceWorkerBanner';
import { startServiceWorkerRegistration } from '@widgets/ServiceWorkerBanner';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Плашка проверяется на живом `App`, а не в одиночку: компонент, который никто
 * не рисует, молчал бы в тесте ровно так же, как и в собранном приложении.
 * Регистрация подменяется до рендера — тем же способом, которым её заводит
 * точка входа.
 */

/**
 * Через сколько гаснет сообщение о готовности к работе без сети. Значение
 * повторяет константу плашки: тест обязан упасть, если оно разойдётся со
 * сказанным пользователю «сообщение уходит само».
 *
 * Задержка проверяется с обеих сторон — за миллисекунду до срока сообщение
 * ещё висит, на сроке его уже нет. Одной проверки «после срока пусто» мало:
 * её прошла бы и задержка в ноль, то есть сообщение, мигнувшее и погасшее
 * раньше, чем его успели прочитать.
 */
const OFFLINE_READY_HIDE_DELAY_MS = 6000;

const UPDATE_MESSAGE = 'Вышла новая версия приложения';

const OFFLINE_READY_MESSAGE = 'Приложение готово к работе без сети';

/**
 * Поддельная регистрация: отдаёт колбэки наружу, чтобы тест проигрывал события
 * service worker сам, и считает переходы на новую версию.
 */
const createFakeRegistration = () => {
  const updateServiceWorker = vi.fn(async () => {});
  const register = vi.fn((_options: RegisterServiceWorkerOptions) => {
    return updateServiceWorker;
  });

  const getOptions = (): RegisterServiceWorkerOptions | undefined => {
    return register.mock.calls.at(-1)?.[0];
  };

  return { getOptions, register, updateServiceWorker };
};

/**
 * Монтирует приложение на экране генератора с уже начатой поддельной
 * регистрацией. Адрес задаётся окну: `BrowserRouter` читает его при
 * монтировании.
 */
const renderAppWithRegistration = () => {
  const registration = createFakeRegistration();

  startServiceWorkerRegistration(registration.register);
  window.history.pushState({}, '', '/');
  render(<App />);

  return registration;
};

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('плашка service worker', () => {
  it('предлагает обновиться, когда новая версия загружена фоном', async () => {
    const { getOptions } = renderAppWithRegistration();

    expect(screen.queryByText(UPDATE_MESSAGE)).toBeNull();

    act(() => {
      getOptions()?.onNeedRefresh();
    });

    expect(screen.getByText(UPDATE_MESSAGE)).toBeDefined();
  });

  it('переходит на новую версию по кнопке', async () => {
    const { getOptions, updateServiceWorker } = renderAppWithRegistration();

    act(() => {
      getOptions()?.onNeedRefresh();
    });

    await userEvent.click(screen.getByRole('button', { name: 'Обновить' }));

    expect(updateServiceWorker).toHaveBeenCalledTimes(1);
  });

  it('показывает ход перехода и не даёт нажать кнопку второй раз', async () => {
    const { getOptions, updateServiceWorker } = renderAppWithRegistration();

    act(() => {
      getOptions()?.onNeedRefresh();
    });

    const updateButton = screen.getByRole('button', { name: 'Обновить' });

    await userEvent.click(updateButton);

    expect(updateButton.getAttribute('aria-busy')).toBe('true');

    await userEvent.click(updateButton);

    /**
     * Переход перезагружает страницу, и до перезагрузки кнопка остаётся на
     * экране: без защиты второе нажатие ушло бы в service worker повторно.
     */
    expect(updateServiceWorker).toHaveBeenCalledTimes(1);
  });

  it('молчит, пока новой версии нет', () => {
    renderAppWithRegistration();

    expect(screen.queryByText(UPDATE_MESSAGE)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Обновить' })).toBeNull();
  });

  it('по «Позже» убирает предложение и остаётся на текущей версии', async () => {
    const { getOptions, updateServiceWorker } = renderAppWithRegistration();

    act(() => {
      getOptions()?.onNeedRefresh();
    });

    await userEvent.click(screen.getByRole('button', { name: 'Позже' }));

    expect(screen.queryByText(UPDATE_MESSAGE)).toBeNull();
    expect(updateServiceWorker).not.toHaveBeenCalled();
  });

  it('показывает готовность к работе без сети один раз: сообщение гаснет само и не возвращается', () => {
    vi.useFakeTimers();

    const { getOptions } = renderAppWithRegistration();

    act(() => {
      getOptions()?.onOfflineReady();
    });

    expect(screen.getByText(OFFLINE_READY_MESSAGE)).toBeDefined();

    act(() => {
      vi.advanceTimersByTime(OFFLINE_READY_HIDE_DELAY_MS - 1);
    });

    expect(screen.getByText(OFFLINE_READY_MESSAGE)).toBeDefined();

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(screen.queryByText(OFFLINE_READY_MESSAGE)).toBeNull();

    /**
     * Повторное открытие приложения без новой установки кэша: колбэк
     * готовности больше не приходит, и сообщения быть не должно.
     */
    cleanup();
    render(<App />);

    expect(screen.queryByText(OFFLINE_READY_MESSAGE)).toBeNull();
  });

  it('при совпадении показывает предложение обновиться и не гасит его таймером готовности', () => {
    vi.useFakeTimers();

    const { getOptions } = renderAppWithRegistration();

    act(() => {
      getOptions()?.onOfflineReady();
      getOptions()?.onNeedRefresh();
    });

    expect(screen.getByText(UPDATE_MESSAGE)).toBeDefined();
    expect(screen.queryByText(OFFLINE_READY_MESSAGE)).toBeNull();

    /**
     * Предложение обновиться ждёт действия пользователя, поэтому срок
     * сообщения о готовности не должен его уносить: место одно, а таймер
     * заведён под другое сообщение.
     */
    act(() => {
      vi.advanceTimersByTime(OFFLINE_READY_HIDE_DELAY_MS);
    });

    expect(screen.getByText(UPDATE_MESSAGE)).toBeDefined();
  });

  it('по «Позже» при совпадении уходят оба сообщения', async () => {
    const { getOptions } = renderAppWithRegistration();

    act(() => {
      getOptions()?.onOfflineReady();
      getOptions()?.onNeedRefresh();
    });

    await userEvent.click(screen.getByRole('button', { name: 'Позже' }));

    expect(screen.queryByText(UPDATE_MESSAGE)).toBeNull();
    expect(screen.queryByText(OFFLINE_READY_MESSAGE)).toBeNull();
  });
});
