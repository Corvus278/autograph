import type { RulingBend } from '@pages/Generator/lib/paper/paper.types';
import { parsePaperSheet } from '@pages/Generator/model/paperSheetJson';
import { describe, expect, it } from 'vitest';

/**
 * Сетка изгиба с несимметричными смещениями: по ним видно, что разбор вернул
 * именно записанные числа, а не нули.
 */
const BEND: RulingBend = {
  columnOrigin: 60,
  columnSpacing: 120,
  columnCount: 3,
  rowOrigin: 80,
  rowSpacing: 40,
  rowCount: 2,
  offsets: [0, 1.25, -0.5, 0.75, 2, -1.5],
};

/**
 * Разлиновка записи новой формы без изгиба. Шаг ненулевой: без шага изгиба не
 * бывает, и проверка разбора упёрлась бы в это правило.
 */
const RULING: Record<string, unknown> = {
  step: 40,
  firstLinePhase: 80,
  skewAngle: 0.5,
  margins: { top: 80, right: 60, bottom: 60, left: 60 },
  marginLineX: null,
  marginLineSide: null,
};

/**
 * Запись экземпляра так, как её оставили артефакт или хранилище.
 *
 * @param ruling — разлиновка записи
 * @returns разобранный JSON экземпляра
 */
const buildEntry = (ruling: Record<string, unknown>): Record<string, unknown> => {
  return {
    id: 'sheet-1',
    label: 'Лист',
    src: 'data:image/jpeg;base64,0123456789',
    width: 480,
    height: 640,
    ruling,
  };
};

/**
 * Сетка изгиба без одного поля.
 *
 * @param key — какое поле убрать
 * @returns сетка без поля
 */
const omitBendField = (key: keyof RulingBend): Record<string, unknown> => {
  return Object.fromEntries(
    Object.entries(BEND).filter(([name]) => {
      return name !== key;
    })
  );
};

/**
 * Случай испорченного изгиба.
 */
type CorruptedBend = {
  /**
   * Признак порчи — попадает в название теста.
   */
  name: string;

  /**
   * Изгиб так, как он лежит в записи.
   */
  bend: unknown;
};

/**
 * Каждый признак порчи — отдельным случаем: разбор, пропустивший один из них,
 * отдал бы отрисовке сетку, выборка по которой читает мимо смещений.
 */
const CORRUPTED_BENDS: CorruptedBend[] = [
  { name: 'строк больше, чем смещений', bend: { ...BEND, rowCount: 3 } },
  { name: 'узлов в строке меньше, чем смещений', bend: { ...BEND, columnCount: 2 } },
  { name: 'дробное число узлов', bend: { ...BEND, columnCount: 1.5, rowCount: 4 } },
  { name: 'нулевой интервал между узлами', bend: { ...BEND, columnSpacing: 0 } },
  { name: 'отрицательный интервал между строками', bend: { ...BEND, rowSpacing: -40 } },
  {
    name: 'смещение строкой',
    bend: { ...BEND, offsets: [0, '1.25', -0.5, 0.75, 2, -1.5] },
  },
  { name: 'смещение null', bend: { ...BEND, offsets: [0, null, -0.5, 0.75, 2, -1.5] } },
  { name: 'начало сетки строкой', bend: { ...BEND, columnOrigin: '60' } },
  { name: 'смещения не массивом', bend: { ...BEND, offsets: 'offsets' } },
  { name: 'нет начала строк', bend: omitBendField('rowOrigin') },
  { name: 'нет смещений', bend: omitBendField('offsets') },
  { name: 'изгиб не объектом', bend: 42 },
];

describe('разбор изгиба линий из JSON', () => {
  it('читает изгиб записи строго равным записанному', () => {
    const sheet = parsePaperSheet(buildEntry({ ...RULING, bend: BEND }));

    expect(sheet?.ruling.bend).toStrictEqual(BEND);
  });

  it('оставляет в списке запись без изгиба ровным листом', () => {
    const sheet = parsePaperSheet(buildEntry(RULING));

    expect(sheet).not.toBeNull();
    expect(sheet?.ruling.bend).toBeNull();
  });

  it('читает явный null ровным листом', () => {
    const sheet = parsePaperSheet(buildEntry({ ...RULING, bend: null }));

    expect(sheet).not.toBeNull();
    expect(sheet?.ruling.bend).toBeNull();
  });

  it.each(CORRUPTED_BENDS)(
    'оставляет в списке ровным лист с испорченным изгибом: $name',
    ({ bend }) => {
      const sheet = parsePaperSheet(buildEntry({ ...RULING, bend }));

      expect(sheet).not.toBeNull();
      expect(sheet?.ruling.step).toBe(40);
      expect(sheet?.ruling.bend).toBeNull();
    }
  );
});
