/**
 * @vitest-environment jsdom
 */
import {
  buildSheetRuling,
  type PaperMargins,
  type PaperSheet,
  type SheetOutline,
} from '@pages/Generator/lib/paper';
import {
  DEFAULT_GENERATOR_STATE,
  useGeneratorStore,
} from '@pages/Generator/model/useGeneratorStore';
import { readUserSheets } from '@pages/Generator/model/userSheetsStorage';
import { PaperGroup } from '@pages/Generator/ui/Generator/SettingsPanel/PaperGroup';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createSyntheticSheet,
  type SyntheticSheetParams,
} from './helpers/synthetic-sheet';
import { readUserRuling, STEP_TOLERANCE } from './helpers/user-sheet-photo';

/**
 * Подменяется только съём пикселей: канвы в jsdom нет. Перемер идёт настоящим
 * измерением — проверяется, что до листа доезжает найденное в границах.
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

const WIDTH = 900;

const HEIGHT = 1200;

const STEP = 30;

/**
 * Клетка на листе, лежащем на столе: стол темнее бумаги и с крупным зерном.
 */
const TABLE_PHOTO: SyntheticSheetParams = {
  width: WIDTH,
  height: HEIGHT,
  step: STEP,
  phase: 7,
  angle: 1,
  kind: 'grid',
  margins: { top: 200, right: 160, bottom: 180, left: 170 },
  lineWidth: 2,
  lineDarkness: 0.3,
  noise: 0.04,
  lighting: 0.2,
  seed: 5,
  surface: {
    outline: {
      topLeft: { x: 130, y: 120 },
      topRight: { x: 790, y: 110 },
      bottomRight: { x: 800, y: 1110 },
      bottomLeft: { x: 140, y: 1120 },
    },
    cornerRadius: 20,
    brightness: 0.3,
    grain: 0.3,
  },
};

/**
 * Контур, найденный «с ошибкой»: дробные углы проверяют округление формы до
 * сотых, а стороны не параллельны краям — начальные значения берутся по
 * вписанному прямоугольнику, а не по одному из углов.
 */
const WRONG_OUTLINE: SheetOutline = {
  topLeft: { x: 20.123, y: 30.456 },
  topRight: { x: 880.5, y: 25.111 },
  bottomRight: { x: 870.014, y: 1180.789 },
  bottomLeft: { x: 15.5, y: 1170.333 },
};

/**
 * Границы листа на снимке, заданные руками: внутри настоящего контура.
 */
const MANUAL_BOUNDS: PaperMargins = { top: 135, right: 115, bottom: 95, left: 150 };

/**
 * Поля, заданные руками до перемера. Шаг ненулевой, иначе форма разлиновки не
 * показала бы поля, и перетирание нечем было бы проверить.
 */
const MANUAL_RULING = {
  step: 41,
  firstLinePhase: 3,
  skewAngle: 0,
  margins: { top: 333, right: 222, bottom: 111, left: 444 },
};

/**
 * Свой лист, у которого автопоиск контура ошибся, а поля поправлены руками.
 * Света и текстуры у него нет: по их появлению видно, что перемер их заменил.
 */
const SEEDED_SHEET: PaperSheet = {
  id: 'user-table',
  label: 'Лист на столе',
  src: 'data:image/jpeg;base64,0123456789',
  width: WIDTH,
  height: HEIGHT,
  ruling: buildSheetRuling(
    { ...MANUAL_RULING, outline: WRONG_OUTLINE },
    { width: WIDTH, height: HEIGHT }
  ),
  lighting: null,
  texture: null,
};

/**
 * Подписи полей границ по сторонам.
 */
const BOUND_LABELS: Record<keyof PaperMargins, string> = {
  top: 'Граница сверху, px',
  right: 'Граница справа, px',
  bottom: 'Граница снизу, px',
  left: 'Граница слева, px',
};

const SIDES = ['top', 'right', 'bottom', 'left'] as const;

/**
 * Прямоугольный контур по отступам от краёв кадра.
 *
 * @param bounds — отступы
 * @returns контур
 */
const toRectOutline = (bounds: PaperMargins): SheetOutline => {
  const right = WIDTH - bounds.right;
  const bottom = HEIGHT - bounds.bottom;

  return {
    topLeft: { x: bounds.left, y: bounds.top },
    topRight: { x: right, y: bounds.top },
    bottomRight: { x: right, y: bottom },
    bottomLeft: { x: bounds.left, y: bottom },
  };
};

/**
 * Кладёт свой лист в стор.
 */
const seedSheet = () => {
  useGeneratorStore.getState().addUserSheet({
    familyId: 'grid',
    isAnalyzed: true,
    sheet: SEEDED_SHEET,
  });
};

/**
 * Запись своего листа в сторе.
 *
 * @returns запись; `undefined` — листа нет
 */
const readUserSheet = (): PaperSheet | undefined => {
  return useGeneratorStore.getState().userSheets[0]?.sheet;
};

/**
 * Вводит границы в форму вместо того, что там было.
 *
 * @param user — сессия `userEvent`
 * @param bounds — отступы от краёв кадра
 */
const fillBounds = async (
  user: ReturnType<typeof userEvent.setup>,
  bounds: PaperMargins
) => {
  for (const side of SIDES) {
    const field = screen.getByLabelText(BOUND_LABELS[side]);

    await user.clear(field);
    await user.type(field, String(bounds[side]));
  }
};

/**
 * Число, стоящее в поле формы.
 *
 * @param label — подпись поля
 * @returns число
 */
const readFieldNumber = (label: string): number => {
  return Number(screen.getByLabelText(label).getAttribute('value'));
};

/**
 * Перемеряет лист в введённых границах.
 *
 * @param user — сессия `userEvent`
 */
const remeasure = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: 'Перемерить в границах' }));
};

beforeEach(() => {
  useGeneratorStore.setState(DEFAULT_GENERATOR_STATE);
  globalThis.localStorage?.clear();
  decodeSheetImage.mockReset();
  decodeSheetImage.mockResolvedValue(createSyntheticSheet(TABLE_PHOTO));
});

afterEach(() => {
  cleanup();
});

describe('ручная правка границ листа', () => {
  it('начальные значения — отступы вписанного прямоугольника, округлённые до сотых', () => {
    seedSheet();
    render(<PaperGroup />);

    expect(readFieldNumber(BOUND_LABELS.top)).toBe(30.46);
    expect(readFieldNumber(BOUND_LABELS.right)).toBe(29.99);
    expect(readFieldNumber(BOUND_LABELS.bottom)).toBe(29.67);
    expect(readFieldNumber(BOUND_LABELS.left)).toBe(20.12);
  });

  it('перемер заменяет разлиновку, свет и текстуру, сохраняя id, подпись и фотографию', async () => {
    const user = userEvent.setup();

    seedSheet();
    render(<PaperGroup />);

    await fillBounds(user, MANUAL_BOUNDS);
    await remeasure(user);

    await waitFor(() => {
      expect(readUserSheet()?.ruling.outline).toStrictEqual(toRectOutline(MANUAL_BOUNDS));
    });

    const sheet = readUserSheet();

    expect(decodeSheetImage).toHaveBeenCalledWith(SEEDED_SHEET.src);
    expect(sheet?.id).toBe(SEEDED_SHEET.id);
    expect(sheet?.label).toBe(SEEDED_SHEET.label);
    expect(sheet?.src).toBe(SEEDED_SHEET.src);
    expect(sheet?.lighting).not.toBeNull();
    expect(Math.abs((sheet?.ruling.step || 0) - STEP)).toBeLessThanOrEqual(
      STEP_TOLERANCE
    );
    expect(readUserSheets()[0]?.sheet).toStrictEqual(sheet);
  }, 60_000);

  it('перемер перетирает поля, заданные руками, и форма разлиновки показывает новые', async () => {
    const user = userEvent.setup();

    seedSheet();
    render(<PaperGroup />);

    await fillBounds(user, MANUAL_BOUNDS);
    await remeasure(user);

    await waitFor(() => {
      expect(readUserSheet()?.ruling.outline).not.toStrictEqual(WRONG_OUTLINE);
    });

    const ruling = readUserRuling();

    expect(ruling).toBeDefined();
    SIDES.forEach((side) => {
      expect(ruling?.margins[side]).not.toBe(MANUAL_RULING.margins[side]);
    });
    expect(readFieldNumber('Шаг строк, px')).toBe(
      Math.round((ruling?.step || 0) * 100) / 100
    );
    expect(readFieldNumber('Левое поле, px')).toBe(
      Math.round((ruling?.margins.left || 0) * 100) / 100
    );
    expect(readFieldNumber(BOUND_LABELS.top)).toBe(MANUAL_BOUNDS.top);
  }, 60_000);

  it.each([
    ['по высоте', { top: 450, right: 0, bottom: 460, left: 0 }],
    ['по ширине', { top: 0, right: 350, bottom: 0, left: 330 }],
    ['отрицательный отступ', { top: -10, right: 0, bottom: 0, left: 0 }],
  ] as const)(
    'границы, оставляющие слишком маленький лист (%s), дают сообщение, лист не меняется',
    async (_name, bounds) => {
      const user = userEvent.setup();

      seedSheet();
      render(<PaperGroup />);

      const before = readUserSheet();

      await fillBounds(user, bounds);
      await remeasure(user);

      expect(
        await screen.findByText('Границы оставляют слишком маленький лист')
      ).toBeDefined();
      expect(readUserSheet()).toBe(before);
      expect(decodeSheetImage).not.toHaveBeenCalled();
    }
  );

  it('после перечтения хранилища лист остаётся с заданным контуром', async () => {
    const user = userEvent.setup();

    seedSheet();
    render(<PaperGroup />);

    await fillBounds(user, MANUAL_BOUNDS);
    await remeasure(user);

    await waitFor(() => {
      expect(readUserSheet()?.ruling.outline).toStrictEqual(toRectOutline(MANUAL_BOUNDS));
    });

    const measured = readUserSheet();

    useGeneratorStore.setState({ userSheets: [] });
    useGeneratorStore.getState().restoreUserSheets();

    expect(readUserSheet()?.ruling.outline).toStrictEqual(toRectOutline(MANUAL_BOUNDS));
    expect(readUserSheet()?.ruling).toEqual(measured?.ruling);
  }, 60_000);
});
