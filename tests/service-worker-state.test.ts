// @vitest-environment jsdom
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { act, cleanup, renderHook } from '@testing-library/react';
import type { RegisterServiceWorkerOptions } from '@widgets/ServiceWorkerBanner';
import {
  startServiceWorkerRegistration,
  useServiceWorkerState,
} from '@widgets/ServiceWorkerBanner';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Виртуальный модуль `virtual:pwa-register` резолвится только сборкой Vite с
 * подключённым плагином: ни vitest, ни Storybook его не видят. Поэтому импорт
 * держится ровно в одном файле, а состояние работает с функцией регистрации
 * как с обычным аргументом. Проверки идут по исходникам: второй такой импорт
 * или вызов регистрации мимо `import.meta.env.PROD` уронят тест, а не
 * Storybook в день релиза.
 */

/**
 * Импорт виртуального модуля плагина PWA. Кавычки в шаблоне обязательны: в
 * кавычках его пишет только настоящий импорт, а в комментариях — в обратных
 * апострофах, и без них проверка падала бы на упоминании в тексте.
 */
const VIRTUAL_MODULE_IMPORT = "'virtual:pwa-register'";

/**
 * Единственный файл, которому этот импорт разрешён.
 */
const REGISTRATION_FILE = 'app/model/serviceWorkerRegistration.ts';

/**
 * Каталог исходников. Считается от корня прогона, а не от `import.meta.url`:
 * в jsdom у модуля адрес схемы `http`, и `fileURLToPath` на нём падает.
 */
const SRC_DIR = path.resolve(process.cwd(), 'src');

/**
 * Блок точки входа, в котором разрешён вызов регистрации: dev-сервер,
 * Storybook и тесты обязаны остаться без service worker.
 */
const PRODUCTION_GUARD = /if \(import\.meta\.env\.PROD\) \{[\s\S]*?\n}/;

/**
 * Пути всех исходников `src`, в которых встречается указанная строка,
 * относительно `src` и с прямыми слэшами.
 */
const findSourcesWith = async (needle: string): Promise<string[]> => {
  const entries = await readdir(SRC_DIR, { recursive: true, withFileTypes: true });

  return entries.reduce<Promise<string[]>>(async (accPromise, entry) => {
    const acc = await accPromise;

    if (!entry.isFile()) {
      return acc;
    }

    const absolutePath = path.join(entry.parentPath, entry.name);
    const content = await readFile(absolutePath, 'utf8');

    if (content.includes(needle)) {
      acc.push(path.relative(SRC_DIR, absolutePath).split(path.sep).join('/'));
    }

    return acc;
  }, Promise.resolve([]));
};

/**
 * Поддельная регистрация: отдаёт колбэки наружу, чтобы тест проигрывал
 * события service worker сам, и считает вызовы перехода на новую версию.
 */
const createFakeRegistration = () => {
  const updateServiceWorker = vi.fn(async () => {});
  const register = vi.fn((_options: RegisterServiceWorkerOptions) => {
    return updateServiceWorker;
  });

  /**
   * Колбэки последней регистрации: ими тест проигрывает события service
   * worker.
   */
  const getOptions = (): RegisterServiceWorkerOptions | undefined => {
    return register.mock.calls.at(-1)?.[0];
  };

  return { getOptions, register, updateServiceWorker };
};

afterEach(() => {
  cleanup();
});

describe('импорт virtual:pwa-register', () => {
  it('живёт ровно в одном файле приложения', async () => {
    const sources = await findSourcesWith(VIRTUAL_MODULE_IMPORT);

    expect(sources).toEqual([REGISTRATION_FILE]);
  });
});

describe('регистрация из точки входа', () => {
  it('вызвана только под import.meta.env.PROD', async () => {
    const source = await readFile(path.join(SRC_DIR, 'app/main.tsx'), 'utf8');
    const [guardedBlock] = source.match(PRODUCTION_GUARD) || [];

    expect(guardedBlock).toContain('startServiceWorkerRegistration(');
    expect(source.replace(PRODUCTION_GUARD, '')).not.toContain(
      'startServiceWorkerRegistration('
    );
  });

  it('питает состояние хука, вызванного без аргумента', () => {
    const { getOptions, register } = createFakeRegistration();

    startServiceWorkerRegistration(register);

    const { result } = renderHook(() => {
      return useServiceWorkerState();
    });

    expect(register).toHaveBeenCalledTimes(1);
    expect(result.current.hasUpdate).toBe(false);

    act(() => {
      getOptions()?.onNeedRefresh();
    });

    expect(result.current.hasUpdate).toBe(true);
  });
});

describe('состояние service worker', () => {
  it('сообщает о готовности к работе без сети', () => {
    const { getOptions, register } = createFakeRegistration();
    const { result } = renderHook(() => {
      return useServiceWorkerState(register);
    });

    expect(result.current.isOfflineReady).toBe(false);

    act(() => {
      getOptions()?.onOfflineReady();
    });

    expect(result.current).toMatchObject({ hasUpdate: false, isOfflineReady: true });
  });

  it('предлагает обновиться и переходит на новую версию по действию', async () => {
    const { getOptions, register, updateServiceWorker } = createFakeRegistration();
    const { result } = renderHook(() => {
      return useServiceWorkerState(register);
    });

    act(() => {
      getOptions()?.onNeedRefresh();
    });

    expect(result.current.hasUpdate).toBe(true);

    await act(async () => {
      result.current.update();
    });

    expect(updateServiceWorker).toHaveBeenCalledTimes(1);
  });

  it('снимает сообщения по закрытию', () => {
    const { getOptions, register } = createFakeRegistration();
    const { result } = renderHook(() => {
      return useServiceWorkerState(register);
    });

    act(() => {
      getOptions()?.onOfflineReady();
      getOptions()?.onNeedRefresh();
    });

    act(() => {
      result.current.dismiss();
    });

    expect(result.current).toMatchObject({ hasUpdate: false, isOfflineReady: false });
  });

  it('молчит, когда регистрация не удалась', () => {
    const { getOptions, register } = createFakeRegistration();
    const { result } = renderHook(() => {
      return useServiceWorkerState(register);
    });

    act(() => {
      getOptions()?.onRegisterError(new Error('Хранилище недоступно'));
    });

    expect(result.current).toMatchObject({ hasUpdate: false, isOfflineReady: false });
  });

  it('не переходит на новую версию, когда её нет', async () => {
    const { register, updateServiceWorker } = createFakeRegistration();
    const { result } = renderHook(() => {
      return useServiceWorkerState(register);
    });

    await act(async () => {
      result.current.update();
    });

    expect(updateServiceWorker).not.toHaveBeenCalled();
  });
});
