/**
 * @vitest-environment jsdom
 */
import type { LayoutPage } from '@pages/Generator/lib/paginate/paginate.types';
import { clearLayoutCache } from '@pages/Generator/model/measureLayout';
import {
  DEFAULT_GENERATOR_STATE,
  useGeneratorStore,
} from '@pages/Generator/model/useGeneratorStore';
import { usePageGeometry } from '@pages/Generator/model/usePageGeometry';
import { usePageLayout } from '@pages/Generator/model/usePageLayout';
import { readUserSheets } from '@pages/Generator/model/userSheetsStorage';
import { PaperGroup } from '@pages/Generator/ui/Generator/SettingsPanel/PaperGroup';
import { cleanup, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { MonospaceMeasurerFactory } from './helpers/monospace-measurer';
import { createMonospaceMeasurerFactory } from './helpers/monospace-measurer';
import { createSyntheticSheet } from './helpers/synthetic-sheet';
import {
  ANGLE_TOLERANCE,
  MARGIN_TOLERANCE,
  readUserRuling,
  RULED_PHOTO,
  TILTED_ANGLE,
  uploadUserPhoto,
} from './helpers/user-sheet-photo';

/**
 * Подменяется только съём пикселей: канвы в jsdom нет. Разлиновку находит
 * настоящий детектор.
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
 * Поля, введённые руками. Левое правее линии поля с зазором, поэтому левый
 * край блока задаёт само поле, а не линия; правое сужает блок вдвое.
 */
const EDITED_MARGINS = { top: 102, right: 150, bottom: 100, left: 140 };

/**
 * Левое поле левее линии поля: блок всё равно не должен заходить на линию.
 */
const LEFT_OF_MARGIN_LINE = 50;

/**
 * Ширина символа измерителя-модели в долях кегля: на шаге 23,5 символ около
 * пяти с половиной пикселей, и сужение блока вдвое заметно по числу строк.
 */
const CHAR_WIDTH = 0.2;

const TEXT =
  'раз два три четыре пять шесть семь восемь девять десять одиннадцать двенадцать';

/**
 * Раскладка и геометрия первой страницы — ровно то, что берут предпросмотр и
 * выгрузка.
 *
 * @param factory — измеритель-модель
 * @returns страницы раскладки и геометрия блока первой страницы
 */
const useLayoutProbe = (factory: MonospaceMeasurerFactory) => {
  const pages = usePageLayout(factory.create);
  const { sheetGeometry } = usePageGeometry(0);

  return { pages, geometry: sheetGeometry };
};

/**
 * Число строк на всех страницах: сужение блока может перенести хвост текста
 * на следующую страницу, и счёт по одной странице его не увидел бы.
 *
 * @param pages — страницы раскладки
 * @returns сколько строк всего
 */
const countLines = (pages: LayoutPage[]): number => {
  return pages.reduce((sum, page) => {
    return sum + page.lines.length;
  }, 0);
};

/**
 * Вводит число в поле формы разлиновки вместо того, что там было.
 */
const fillField = async (
  user: ReturnType<typeof userEvent.setup>,
  label: string,
  value: number
) => {
  const field = screen.getByLabelText(label);

  await user.clear(field);
  await user.type(field, String(value));
};

/**
 * Число, стоящее в поле формы разлиновки.
 */
const readFieldNumber = (label: string): number => {
  return Number(screen.getByLabelText(label).getAttribute('value'));
};

/**
 * Применяет введённую в форму разлиновку.
 */
const applyRuling = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: 'Применить разлиновку' }));
};

beforeEach(() => {
  clearLayoutCache();
  useGeneratorStore.setState({ ...DEFAULT_GENERATOR_STATE, text: TEXT });
  globalThis.localStorage?.clear();
  decodeSheetImage.mockReset();
  decodeSheetImage.mockResolvedValue(createSyntheticSheet(RULED_PHOTO));
});

afterEach(() => {
  cleanup();
});

describe('ручная правка разлиновки', () => {
  it('форма показывает поля, найденные на фотографии', async () => {
    const user = userEvent.setup();

    render(<PaperGroup />);
    await uploadUserPhoto(user);

    expect(
      Math.abs(readFieldNumber('Верхнее поле, px') - RULED_PHOTO.margins.top)
    ).toBeLessThanOrEqual(MARGIN_TOLERANCE);
    expect(
      Math.abs(readFieldNumber('Правое поле, px') - RULED_PHOTO.margins.right)
    ).toBeLessThanOrEqual(MARGIN_TOLERANCE);
    expect(
      Math.abs(readFieldNumber('Нижнее поле, px') - RULED_PHOTO.margins.bottom)
    ).toBeLessThanOrEqual(MARGIN_TOLERANCE);
    expect(
      Math.abs(readFieldNumber('Левое поле, px') - RULED_PHOTO.margins.left)
    ).toBeLessThanOrEqual(MARGIN_TOLERANCE);
  });

  it('исправленные поля доезжают до блока текста и раскладки', async () => {
    const user = userEvent.setup();
    const factory = createMonospaceMeasurerFactory({ charWidth: CHAR_WIDTH });

    render(<PaperGroup />);
    await uploadUserPhoto(user);

    const { result } = renderHook(() => {
      return useLayoutProbe(factory);
    });

    await waitFor(() => {
      expect(countLines(result.current.pages)).toBeGreaterThan(0);
    });

    const linesBefore = countLines(result.current.pages);

    await fillField(user, 'Верхнее поле, px', EDITED_MARGINS.top);
    await fillField(user, 'Правое поле, px', EDITED_MARGINS.right);
    await fillField(user, 'Нижнее поле, px', EDITED_MARGINS.bottom);
    await fillField(user, 'Левое поле, px', EDITED_MARGINS.left);
    await applyRuling(user);

    expect(readUserRuling()?.margins).toEqual(EDITED_MARGINS);

    await waitFor(() => {
      expect(result.current.geometry?.leftPadding).toBeCloseTo(EDITED_MARGINS.left, 6);
    });

    const { geometry } = result.current;

    expect((geometry?.leftPadding || 0) + (geometry?.blockWidth || 0)).toBeCloseTo(
      RULED_PHOTO.width - EDITED_MARGINS.right,
      6
    );

    /**
     * Блок сузился вдвое — те же слова не помещаются в прежнее число строк.
     */
    await waitFor(() => {
      expect(countLines(result.current.pages)).toBeGreaterThan(linesBefore);
    });
  });

  it('правка полей не теряет найденную линию поля', async () => {
    const user = userEvent.setup();
    const factory = createMonospaceMeasurerFactory({ charWidth: CHAR_WIDTH });

    render(<PaperGroup />);
    await uploadUserPhoto(user);

    const { result } = renderHook(() => {
      return useLayoutProbe(factory);
    });

    await fillField(user, 'Левое поле, px', LEFT_OF_MARGIN_LINE);
    await applyRuling(user);

    const ruling = readUserRuling();

    expect(ruling?.margins.left).toBe(LEFT_OF_MARGIN_LINE);
    expect(ruling?.marginLineSide).toBe('left');
    expect(
      Math.abs((ruling?.marginLineX || 0) - RULED_PHOTO.marginLineX)
    ).toBeLessThanOrEqual(MARGIN_TOLERANCE);

    await waitFor(() => {
      expect(result.current.geometry).not.toBeNull();
    });

    /**
     * Сценарий «Найденные границы доезжают до отрисовки»: край блока отстоит
     * от линии поля не меньше чем на пятую часть шага.
     */
    expect(result.current.geometry?.leftPadding).toBeGreaterThanOrEqual(
      (ruling?.marginLineX || 0) + (ruling?.step || 0) / 5 - 1e-6
    );
  });

  it('правка разлиновки не меняет наклон повёрнутого листа', async () => {
    const user = userEvent.setup();

    decodeSheetImage.mockResolvedValue(
      createSyntheticSheet({ ...RULED_PHOTO, angle: TILTED_ANGLE })
    );

    render(<PaperGroup />);
    await uploadUserPhoto(user);

    const importedAngle = readUserRuling()?.skewAngle || 0;

    /**
     * Без найденного наклона проверка ниже прошла бы и на листе, потерявшем
     * угол: ноль равен нулю.
     */
    expect(Math.abs(importedAngle - TILTED_ANGLE)).toBeLessThanOrEqual(ANGLE_TOLERANCE);

    await fillField(user, 'Левое поле, px', EDITED_MARGINS.left);
    await applyRuling(user);

    expect(readUserRuling()?.margins.left).toBe(EDITED_MARGINS.left);
    expect(readUserRuling()?.skewAngle).toBe(importedAngle);
  });

  it('исправленная разлиновка переживает перечтение хранилища', async () => {
    const user = userEvent.setup();

    render(<PaperGroup />);
    await uploadUserPhoto(user);

    await fillField(user, 'Шаг строк, px', 25);
    await fillField(user, 'Первая строка от верха, px', 12);
    await fillField(user, 'Правое поле, px', EDITED_MARGINS.right);
    await fillField(user, 'Левое поле, px', EDITED_MARGINS.left);
    await applyRuling(user);

    const [stored] = readUserSheets();

    expect(stored?.sheet.ruling).toEqual(readUserRuling());
    expect(stored?.sheet.ruling.step).toBe(25);
    expect(stored?.sheet.ruling.firstLinePhase).toBe(12);
    expect(stored?.sheet.ruling.margins.right).toBe(EDITED_MARGINS.right);
    expect(stored?.sheet.ruling.margins.left).toBe(EDITED_MARGINS.left);
    expect(stored?.sheet.ruling.marginLineX).not.toBeNull();
  });
});
