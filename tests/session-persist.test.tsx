/**
 * @vitest-environment jsdom
 */
import {
  CUSTOM_FONT_FAMILY,
  HANDWRITING_FONTS,
  LINED_FAMILY_ID,
} from '@pages/Generator/config';
import { SESSION_VERSION } from '@pages/Generator/model/sessionSchema';
import { selectIsUndoAvailable } from '@pages/Generator/model/useGeneratorStore';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Ключ сессии в локальном хранилище.
 */
const SESSION_KEY = 'autograph.session';

/**
 * Время, за которое дросселированная запись гарантированно доходит до
 * хранилища.
 */
const WRITE_DELAY_MS = 1000;

/**
 * Стор, импортированный заново: так проверяется перезагрузка страницы —
 * модуль стора создаётся с нуля и читает сессию из хранилища, как при
 * открытии вкладки.
 *
 * @returns свежий экземпляр настоящего стора
 */
const loadStore = async () => {
  vi.resetModules();

  const { useGeneratorStore } = await import('@pages/Generator/model/useGeneratorStore');

  return useGeneratorStore;
};

/**
 * Разобранная запись сессии из хранилища.
 *
 * @returns запись или `null`, если её нет
 */
const readStoredSession = (): unknown => {
  const raw = globalThis.localStorage.getItem(SESSION_KEY);

  return raw ? JSON.parse(raw) : null;
};

beforeEach(() => {
  vi.useFakeTimers();
  globalThis.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  globalThis.localStorage.clear();
});

describe('сессия в локальном хранилище', () => {
  it('восстанавливается после пересоздания стора', async () => {
    const store = await loadStore();
    const { getState } = store;

    getState().setText('Мой текст');
    getState().selectFamily(LINED_FAMILY_ID);
    getState().selectRealismLevel('sloppy');
    getState().setIsSpread(true);
    getState().setInk({ kind: 'tone', toneId: 'gel-blue' });
    getState().setZoom(2);
    getState().goToPage(3);
    getState().startNewRun();

    const before = getState();

    vi.advanceTimersByTime(WRITE_DELAY_MS);

    const reloaded = (await loadStore()).getState();

    expect(reloaded.text).toBe('Мой текст');
    expect(reloaded.familyId).toBe(LINED_FAMILY_ID);
    expect(reloaded.sheetId).toBe(before.sheetId);
    expect(reloaded.realism).toEqual(before.realism);
    expect(reloaded.realism.level).toBe('sloppy');
    expect(reloaded.ink).toEqual({ kind: 'tone', toneId: 'gel-blue' });
    expect(reloaded.runSeed).toBe(before.runSeed);
    expect(reloaded.isSpread).toBe(true);
    expect(reloaded.zoom).toBe('fit');
    expect(reloaded.pageIndex).toBe(0);
    expect(selectIsUndoAvailable(before)).toBe(true);
    expect(selectIsUndoAvailable(reloaded)).toBe(false);
  });

  it('пишет документ и разворот с версией, без ресурсов и прочего просмотра', async () => {
    const { getState } = await loadStore();

    getState().setText('Проверка');
    getState().setCustomScene('data:image/png;base64,AAAA');
    vi.advanceTimersByTime(WRITE_DELAY_MS);

    const stored = readStoredSession();

    expect(stored).toMatchObject({
      version: SESSION_VERSION,
      state: { text: 'Проверка' },
    });
    expect(stored).toHaveProperty('state.isSpread');

    for (const field of [
      'pageIndex',
      'zoom',
      'presetFamilies',
      'userSheets',
      'customFontFamily',
      'customSceneSrc',
      'isBackgroundHidden',
    ]) {
      expect(stored).not.toHaveProperty(`state.${field}`);
    }
  });

  it('подключённый свой шрифт не сохраняется: после перезагрузки — первый встроенный', async () => {
    const { getState } = await loadStore();

    getState().setFontFamily(HANDWRITING_FONTS[3]?.family || '');
    getState().setCustomFontFamily(CUSTOM_FONT_FAMILY);
    getState().setText('Своим шрифтом');
    vi.advanceTimersByTime(WRITE_DELAY_MS);

    const reloaded = (await loadStore()).getState();

    expect(reloaded.customFontFamily).toBeNull();
    expect(reloaded.fontFamily).toBe(HANDWRITING_FONTS[0]?.family);
    expect(reloaded.text).toBe('Своим шрифтом');
  });

  it('встроенный почерк без своего шрифта сохраняется', async () => {
    const family = HANDWRITING_FONTS[3]?.family || '';
    const { getState } = await loadStore();

    getState().setFontFamily(family);
    vi.advanceTimersByTime(WRITE_DELAY_MS);

    expect((await loadStore()).getState().fontFamily).toBe(family);
  });

  it('запись дросселируется: набор текста не пишет хранилище на каждый символ', async () => {
    const { getState } = await loadStore();
    const setItem = vi.spyOn(Storage.prototype, 'setItem');

    for (const text of ['П', 'Пр', 'При', 'Прив', 'Приве', 'Привет']) {
      getState().setText(text);
      vi.advanceTimersByTime(50);
    }

    const sessionWrites = () => {
      return setItem.mock.calls.filter(([key]) => {
        return key === SESSION_KEY;
      });
    };

    expect(sessionWrites().length).toBeLessThanOrEqual(1);

    vi.advanceTimersByTime(WRITE_DELAY_MS);

    expect(readStoredSession()).toMatchObject({ state: { text: 'Привет' } });
    expect(sessionWrites().length).toBeLessThanOrEqual(2);
  });

  it('уход со страницы дописывает отложенную запись сразу', async () => {
    const { getState } = await loadStore();

    getState().setText('Перед закрытием');
    globalThis.dispatchEvent(new Event('pagehide'));

    expect(readStoredSession()).toMatchObject({ state: { text: 'Перед закрытием' } });
  });

  it('генератор работает, когда запись бросает QuotaExceededError', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('переполнено', 'QuotaExceededError');
    });

    const { getState } = await loadStore();

    expect(() => {
      getState().setText('Не влезло');
      getState().selectRealismLevel('neat');
      vi.advanceTimersByTime(WRITE_DELAY_MS);
      globalThis.dispatchEvent(new Event('pagehide'));
    }).not.toThrow();

    expect(getState().text).toBe('Не влезло');
    expect(getState().realism.level).toBe('neat');
    expect(readStoredSession()).toBeNull();
  });

  it('хранилище запрещено браузером — генератор открывается с настройками по умолчанию', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('запрещено', 'SecurityError');
    });

    const { getState } = await loadStore();

    expect(getState().realism.level).toBe('normal');
    expect(() => {
      getState().setText('Работает');
    }).not.toThrow();
    expect(getState().text).toBe('Работает');
  });

  it.each([
    ['мусор', '{не json'],
    ['чужая версия', JSON.stringify({ state: { text: 'Из будущего' }, version: 99 })],
  ])('%s в хранилище — настройки по умолчанию', async (_, raw) => {
    const { DEFAULT_GENERATOR_STATE } =
      await import('@pages/Generator/model/useGeneratorStore');

    globalThis.localStorage.setItem(SESSION_KEY, raw);

    const { getState } = await loadStore();

    expect(getState().text).toBe(DEFAULT_GENERATOR_STATE.text);
    expect(getState().realism).toEqual(DEFAULT_GENERATOR_STATE.realism);
  });

  it('негодное поле получает дефолт, остальные восстанавливаются', async () => {
    globalThis.localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        state: { text: 'Сохранённый', realism: { level: 'хаос' }, isSpread: true },
        version: SESSION_VERSION,
      })
    );

    const { getState } = await loadStore();

    expect(getState().text).toBe('Сохранённый');
    expect(getState().isSpread).toBe(true);
    expect(getState().realism.level).toBe('normal');
  });
});
