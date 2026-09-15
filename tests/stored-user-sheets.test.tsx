// @vitest-environment jsdom

import type { PaperSheet } from '@pages/Generator/lib/paper';
import { selectPendingUserSheets } from '@pages/Generator/model/paperSelectors';
import {
  DEFAULT_GENERATOR_STATE,
  useGeneratorStore,
} from '@pages/Generator/model/useGeneratorStore';
import {
  clearUserSheets,
  writeUserSheet,
} from '@pages/Generator/model/userSheetsStorage';
import { useStoredUserSheets } from '@pages/Generator/model/useStoredUserSheets';
import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const SHEET: PaperSheet = {
  id: 'user-1',
  label: 'Мой лист',
  src: 'data:image/jpeg;base64,AA==',
  width: 1200,
  height: 1600,
  ruling: {
    step: 64,
    firstLinePhase: 71.5,
    skewAngle: -1.2,
    margins: { top: 135.5, right: 90, bottom: 110, left: 120 },
    marginLineX: 1080,
    marginLineSide: 'right',
    bend: null,
    perspective: null,
    outline: null,
  },
  lighting: null,
  texture: null,
};

describe('восстановление своих листов при открытии генератора', () => {
  beforeEach(() => {
    clearUserSheets();
    useGeneratorStore.setState(DEFAULT_GENERATOR_STATE);
  });

  afterEach(() => {
    cleanup();
    clearUserSheets();
  });

  it('возвращает лист из хранилища в стор', () => {
    writeUserSheet({ familyId: 'lined', sheet: SHEET, isAnalyzed: true });

    renderHook(() => {
      return useStoredUserSheets();
    });

    const [restored] = useGeneratorStore.getState().userSheets;

    expect(restored?.sheet.id).toBe(SHEET.id);
    expect(restored?.sheet.ruling).toEqual(SHEET.ruling);
  });

  it('не ставит восстановленный лист в очередь на повторный анализ', () => {
    writeUserSheet({ familyId: 'lined', sheet: SHEET, isAnalyzed: true });

    renderHook(() => {
      return useStoredUserSheets();
    });

    expect(selectPendingUserSheets(useGeneratorStore.getState())).toHaveLength(0);
  });
});
