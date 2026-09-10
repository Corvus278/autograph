// @vitest-environment jsdom

import type { PaperSheet } from '@pages/Generator/lib/paper';
import {
  selectPaperFamilies,
  selectPendingUserSheets,
} from '@pages/Generator/model/paperSelectors';
import {
  DEFAULT_GENERATOR_STATE,
  useGeneratorStore,
} from '@pages/Generator/model/useGeneratorStore';
import type { UserSheetRecord } from '@pages/Generator/model/userSheetsStorage.types';
import { beforeEach, describe, expect, it } from 'vitest';

/**
 * Стор объявлен вне React, поэтому проверяется вызовами напрямую.
 */
const store = () => {
  return useGeneratorStore.getState();
};

/**
 * Фотография пользователя приходит как data URL. Строка короткая: проверяется
 * раздельное хранение, а не объём.
 */
const PHOTO_SRC = 'data:image/jpeg;base64,0123456789';

/**
 * Лист с посчитанными характеристиками: заметный наклон, нормировка не единица
 * и своя фаза первой линии — по ним видно, что после перезагрузки вернулись
 * именно измерения, а не значения по умолчанию.
 */
const buildMeasuredSheet = (id: string): PaperSheet => {
  return {
    id,
    label: 'Мой лист',
    src: PHOTO_SRC,
    width: 1200,
    height: 1600,
    skewAngle: -1.4,
    measuredStep: 64,
    normalizeScale: 1.25,
    firstLinePhase: 73.5,
    lighting: {
      gridWidth: 2,
      gridHeight: 2,
      values: [1, 0.9, 0.85, 0.8],
      contrast: 0.2,
      isUsable: true,
    },
    texture: {
      src: 'data:image/png;base64,texture',
      width: 8,
      height: 8,
      amplitude: 0.04,
    },
  };
};

const buildRecord = (id: string, isAnalyzed = true): UserSheetRecord => {
  return { familyId: 'grid', sheet: buildMeasuredSheet(id), isAnalyzed };
};

/**
 * Перезагрузка страницы: состояние стора теряется, локальное хранилище — нет.
 */
const reload = () => {
  useGeneratorStore.setState(DEFAULT_GENERATOR_STATE);
};

beforeEach(() => {
  globalThis.localStorage.clear();
  useGeneratorStore.setState(DEFAULT_GENERATOR_STATE);
});

describe('пользовательские листы в сторе', () => {
  it('добавляет лист в его семью и выбирает его', () => {
    store().addUserSheet(buildRecord('user-1'));

    const family = selectPaperFamilies(store()).find((item) => {
      return item.id === 'grid';
    });

    expect(family?.sheets.at(-1)?.id).toBe('user-1');
    expect(store().sheetId).toBe('user-1');
  });

  it('не добавляет лист в чужую семью', () => {
    store().addUserSheet(buildRecord('user-1'));

    const lined = selectPaperFamilies(store()).find((item) => {
      return item.id === 'lined';
    });

    expect(
      lined?.sheets.some((sheet) => {
        return sheet.id === 'user-1';
      })
    ).toBe(false);
  });

  it('хранит исходный файл отдельно от списка характеристик', () => {
    store().addUserSheet(buildRecord('user-1'));

    const index = globalThis.localStorage.getItem('handwriting.paper.user-sheets') || '';

    expect(globalThis.localStorage.getItem('handwriting.paper.source.user-1')).toBe(
      PHOTO_SRC
    );
    expect(index).not.toContain(PHOTO_SRC);
    expect(index).toContain('user-1');
  });
});

describe('переживание перезагрузки', () => {
  it('возвращает лист с теми же характеристиками', () => {
    const record = buildRecord('user-1');

    store().addUserSheet(record);
    reload();

    expect(store().userSheets).toHaveLength(0);

    store().restoreUserSheets();

    expect(store().userSheets).toEqual([record]);
  });

  it('не запускает повторный анализ восстановленного листа', () => {
    store().addUserSheet(buildRecord('user-1'));
    reload();
    store().restoreUserSheets();

    expect(selectPendingUserSheets(store())).toHaveLength(0);
  });

  it('оставляет в очереди анализа лист, характеристики которого ещё не посчитаны', () => {
    store().addUserSheet(buildRecord('user-2', false));

    expect(selectPendingUserSheets(store())).toHaveLength(1);
  });
});

describe('удаление пользовательского листа', () => {
  it('убирает лист из списка и переводит выбор на оставшийся экземпляр', () => {
    store().addUserSheet(buildRecord('user-1'));
    store().removeUserSheet('user-1');

    expect(store().userSheets).toHaveLength(0);
    expect(store().sheetId).toBe('grid-1');
  });

  it('убирает лист из хранилища вместе с файлом и производными', () => {
    store().addUserSheet(buildRecord('user-1'));
    store().removeUserSheet('user-1');
    reload();
    store().restoreUserSheets();

    expect(store().userSheets).toHaveLength(0);
    expect(globalThis.localStorage.getItem('handwriting.paper.source.user-1')).toBeNull();
    expect(
      globalThis.localStorage.getItem('handwriting.paper.derived.user-1')
    ).toBeNull();
  });

  it('не трогает соседний лист', () => {
    store().addUserSheet(buildRecord('user-1'));
    store().addUserSheet(buildRecord('user-2'));
    store().removeUserSheet('user-1');
    reload();
    store().restoreUserSheets();

    expect(
      store().userSheets.map((record) => {
        return record.sheet.id;
      })
    ).toEqual(['user-2']);
  });
});
