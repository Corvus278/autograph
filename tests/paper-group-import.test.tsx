/**
 * @vitest-environment jsdom
 */
import type { PaperMargins } from '@pages/Generator/lib/paper';
import {
  DEFAULT_GENERATOR_STATE,
  useGeneratorStore,
} from '@pages/Generator/model/useGeneratorStore';
import { readUserSheets } from '@pages/Generator/model/userSheetsStorage';
import { PaperGroup } from '@pages/Generator/ui/Generator/SettingsPanel/PaperGroup';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createSyntheticSheet } from './helpers/synthetic-sheet';
import {
  ANGLE_TOLERANCE,
  MARGIN_TOLERANCE,
  readUserRuling,
  RULED_PHOTO,
  RULED_PHOTO_FOUND_MARGINS,
  STEP_TOLERANCE,
  TILTED_ANGLE,
  uploadUserPhoto,
} from './helpers/user-sheet-photo';

/**
 * Подменяется только съём пикселей: канвы в jsdom нет. Измерения идут
 * настоящим детектором — проверяется, что до листа доезжает всё найденное, а
 * не то, что панель передала заранее известный ответ.
 */
const { decodeSheetImage } = vi.hoisted(() => {
  return { decodeSheetImage: vi.fn() };
});

vi.mock(
  '@pages/Generator/ui/Generator/SettingsPanel/PaperGroup/useSheetImport/decodeSheetImage',
  () => {
    return { decodeSheetImage };
  }
);

/**
 * Наибольший промах по полям: одна сторона, потерянная по дороге, даёт промах
 * на всю её ширину.
 *
 * @param actual — поля листа
 * @param expected — поля, нарисованные на снимке
 * @returns промах в пикселях
 */
const measureMarginMiss = (actual: PaperMargins, expected: PaperMargins): number => {
  return Math.max(
    Math.abs(actual.top - expected.top),
    Math.abs(actual.right - expected.right),
    Math.abs(actual.bottom - expected.bottom),
    Math.abs(actual.left - expected.left)
  );
};

beforeEach(() => {
  useGeneratorStore.setState(DEFAULT_GENERATOR_STATE);
  globalThis.localStorage?.clear();
  decodeSheetImage.mockReset();
});

afterEach(() => {
  cleanup();
});

describe('импорт фотографии листа', () => {
  it('сохраняет у листа найденные шаг, поля и линию поля', async () => {
    const user = userEvent.setup();

    decodeSheetImage.mockResolvedValue(createSyntheticSheet(RULED_PHOTO));

    render(<PaperGroup />);
    await uploadUserPhoto(user);

    const ruling = readUserRuling();

    expect(Math.abs((ruling?.step || 0) - RULED_PHOTO.step)).toBeLessThanOrEqual(
      STEP_TOLERANCE
    );
    expect(
      ruling && measureMarginMiss(ruling.margins, RULED_PHOTO_FOUND_MARGINS)
    ).toBeLessThanOrEqual(MARGIN_TOLERANCE);
    expect(ruling?.marginLineSide).toBe('left');
    expect(
      Math.abs((ruling?.marginLineX || 0) - RULED_PHOTO.marginLineX)
    ).toBeLessThanOrEqual(MARGIN_TOLERANCE);
  });

  it('сохраняет у повёрнутого листа найденный угол наклона', async () => {
    const user = userEvent.setup();

    decodeSheetImage.mockResolvedValue(
      createSyntheticSheet({ ...RULED_PHOTO, angle: TILTED_ANGLE })
    );

    render(<PaperGroup />);
    await uploadUserPhoto(user);

    const ruling = readUserRuling();

    expect(Math.abs((ruling?.skewAngle || 0) - TILTED_ANGLE)).toBeLessThanOrEqual(
      ANGLE_TOLERANCE
    );
    expect(Math.abs((ruling?.step || 0) - RULED_PHOTO.step)).toBeLessThanOrEqual(
      STEP_TOLERANCE
    );
  });

  it('кладёт в хранилище ту же разлиновку, что и в стор', async () => {
    const user = userEvent.setup();

    decodeSheetImage.mockResolvedValue(createSyntheticSheet(RULED_PHOTO));

    render(<PaperGroup />);
    await uploadUserPhoto(user);

    const [stored] = readUserSheets();

    expect(stored?.sheet.ruling).toEqual(readUserRuling());
  });

  it('на ненайденной разлиновке оставляет лист с нулевым шагом и без линии поля', async () => {
    const user = userEvent.setup();

    decodeSheetImage.mockResolvedValue(
      createSyntheticSheet({
        ...RULED_PHOTO,
        kind: 'blank',
        marginLineX: null,
        noise: 0.06,
        lighting: 0.3,
      })
    );

    render(<PaperGroup />);
    await uploadUserPhoto(user);

    expect(readUserRuling()?.step).toBe(0);
    expect(readUserRuling()?.marginLineX).toBeNull();
    expect(screen.getByLabelText('Левое поле, px').getAttribute('value')).toBe('');
  });
});
