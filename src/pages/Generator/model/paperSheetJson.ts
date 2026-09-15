import type {
  LightingField,
  MarginLineSide,
  PaperMargins,
  PaperSheet,
  PaperTexture,
  RulingBend,
  SheetFrame,
  SheetRuling,
} from '../lib/paper/paper.types';
import { buildSheetRuling } from '../lib/paper/sheetRuling';

/**
 * Разобранный JSON — не то же самое, что объект нужного типа: и артефакт
 * профилей, и локальное хранилище приходят извне сборки и могут отстать от
 * кода. Проверка формой, а не приведением типа: экземпляр, у которого не
 * хватает обязательного поля, отбрасывается целиком, а не роняет генератор
 * позже, в отрисовке.
 *
 * @param value — разобранное значение
 * @returns признак того, что значение — объект с полями
 */
export const isJsonRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

/**
 * Конечное число или запасное значение.
 *
 * @param value — разобранное значение
 * @param fallback — что подставить вместо мусора
 * @returns число
 */
export const toFiniteNumber = (value: unknown, fallback: number): number => {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
};

/**
 * Непустая строка или пустая, если строки не было.
 *
 * @param value — разобранное значение
 * @returns строка; пустая означает «значения нет»
 */
export const toText = (value: unknown): string => {
  return typeof value === 'string' ? value : '';
};

/**
 * Поле освещения из JSON. `null` — поля нет или оно нечитаемо: отрисовка
 * возьмёт синтетический свет.
 *
 * @param value — разобранное значение
 * @returns поле освещения или `null`
 */
const parseLighting = (value: unknown): LightingField | null => {
  if (!isJsonRecord(value) || !Array.isArray(value.values)) {
    return null;
  }

  const items: unknown[] = value.values;

  return {
    gridWidth: toFiniteNumber(value.gridWidth, 0),
    gridHeight: toFiniteNumber(value.gridHeight, 0),
    values: items.reduce<number[]>((acc, item) => {
      acc.push(toFiniteNumber(item, 0));

      return acc;
    }, []),
    contrast: toFiniteNumber(value.contrast, 0),
    isUsable: value.isUsable === true,
  };
};

/**
 * Карта текстуры из JSON. `null` — карты нет или в ней нет картинки. Чем
 * задана картинка, разбору всё равно: и путь к файлу рядом с фотографией, и
 * data URL — просто непустая строка.
 *
 * @param value — разобранное значение
 * @returns карта текстуры или `null`
 */
const parseTexture = (value: unknown): PaperTexture | null => {
  if (!isJsonRecord(value)) {
    return null;
  }

  const src = toText(value.src);

  if (!src) {
    return null;
  }

  return {
    src,
    width: toFiniteNumber(value.width, 0),
    height: toFiniteNumber(value.height, 0),
    amplitude: toFiniteNumber(value.amplitude, 0),
  };
};

/**
 * Край линии поля из JSON.
 *
 * @param value — разобранное значение
 * @returns край; `null` — края нет или он нечитаем
 */
const parseMarginLineSide = (value: unknown): MarginLineSide | null => {
  return value === 'left' || value === 'right' ? value : null;
};

/**
 * Поля листа из JSON. Нечитаемое поле становится нулём: сборка разлиновки
 * считает такую сторону ненайденной и отступает с неё фолбэком.
 *
 * @param value — разобранное значение
 * @returns поля листа
 */
const parseMargins = (value: unknown): PaperMargins => {
  const margins: Record<string, unknown> = isJsonRecord(value) ? value : {};

  return {
    top: toFiniteNumber(margins.top, 0),
    right: toFiniteNumber(margins.right, 0),
    bottom: toFiniteNumber(margins.bottom, 0),
    left: toFiniteNumber(margins.left, 0),
  };
};

/**
 * Конечное число в JSON.
 *
 * @param value — разобранное значение
 * @returns признак конечного числа
 */
const isFiniteNumber = (value: unknown): value is number => {
  return typeof value === 'number' && Number.isFinite(value);
};

/**
 * Интервал сетки: у узлов, стоящих в одной точке или в обратном порядке,
 * выборка делила бы на ноль или читала узлы задом наперёд.
 *
 * @param value — разобранное значение
 * @returns признак положительного конечного числа
 */
const isPositiveNumber = (value: unknown): value is number => {
  return isFiniteNumber(value) && value > 0;
};

/**
 * Размер сетки: дробное число узлов разошлось бы с плоским индексом смещений.
 *
 * @param value — разобранное значение
 * @returns признак целого положительного числа
 */
const isNodeCount = (value: unknown): value is number => {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
};

/**
 * Изгиб линий из JSON. Испорченная сетка — размеры, не согласованные с числом
 * смещений, неположительный интервал, нечисловое значение — читается как
 * отсутствие изгиба: такой лист ровный, а не сломанный, и остаётся в списке.
 * Частично годную сетку не чиним: смещения, прочитанные по неверным размерам,
 * встали бы не в те узлы.
 *
 * @param value — разобранное значение
 * @returns сетка изгиба; `null` — изгиба нет или он нечитаем
 */
const parseRulingBend = (value: unknown): RulingBend | null => {
  if (!isJsonRecord(value)) {
    return null;
  }

  const {
    columnOrigin,
    columnSpacing,
    columnCount,
    rowOrigin,
    rowSpacing,
    rowCount,
    offsets,
  } = value;

  if (
    !isFiniteNumber(columnOrigin) ||
    !isFiniteNumber(rowOrigin) ||
    !isPositiveNumber(columnSpacing) ||
    !isPositiveNumber(rowSpacing) ||
    !isNodeCount(columnCount) ||
    !isNodeCount(rowCount) ||
    !Array.isArray(offsets) ||
    offsets.length !== columnCount * rowCount
  ) {
    return null;
  }

  const items: unknown[] = offsets;

  if (
    !items.every((item): item is number => {
      return isFiniteNumber(item);
    })
  ) {
    return null;
  }

  return {
    columnOrigin,
    columnSpacing,
    columnCount,
    rowOrigin,
    rowSpacing,
    rowCount,
    offsets: items,
  };
};

/**
 * Разлиновка экземпляра из JSON. Запись прежней формы разлиновки не несёт: шаг,
 * фаза и наклон берутся из полей самого экземпляра, поля и линия поля —
 * фолбэком.
 *
 * @param value — разобранный экземпляр
 * @param frame — кадр фотографии экземпляра: от него считается фолбэк полей
 * @returns разлиновка экземпляра
 */
const parseSheetRuling = (
  value: Record<string, unknown>,
  frame: SheetFrame
): SheetRuling => {
  const { ruling } = value;

  if (!isJsonRecord(ruling)) {
    return buildSheetRuling(
      {
        step: toFiniteNumber(value.measuredStep, 0),
        firstLinePhase: toFiniteNumber(value.firstLinePhase, 0),
        skewAngle: toFiniteNumber(value.skewAngle, 0),
      },
      frame
    );
  }

  return buildSheetRuling(
    {
      step: toFiniteNumber(ruling.step, 0),
      firstLinePhase: toFiniteNumber(ruling.firstLinePhase, 0),
      skewAngle: toFiniteNumber(ruling.skewAngle, 0),
      margins: parseMargins(ruling.margins),
      marginLineX: toFiniteNumber(ruling.marginLineX, 0) || null,
      marginLineSide: parseMarginLineSide(ruling.marginLineSide),
      bend: parseRulingBend(ruling.bend),
    },
    frame
  );
};

/**
 * Экземпляр листа из JSON. Обязательны только идентификатор и фотография:
 * экземпляр без них нечем показать и не с чем связать, поэтому такой
 * отбрасывается. Остальное — измерения, и отсутствующее измерение заменяется
 * нейтральным: лист остаётся в списке, а недостающие поля разлиновки
 * берутся фолбэком.
 *
 * @param value — разобранное значение
 * @returns экземпляр листа или `null`, если его нечем показать
 */
export const parsePaperSheet = (value: unknown): PaperSheet | null => {
  if (!isJsonRecord(value)) {
    return null;
  }

  const id = toText(value.id);
  const src = toText(value.src);

  if (!id || !src) {
    return null;
  }

  const frame = {
    width: toFiniteNumber(value.width, 0),
    height: toFiniteNumber(value.height, 0),
  };

  return {
    id,
    label: toText(value.label) || id,
    src,
    width: frame.width,
    height: frame.height,
    ruling: parseSheetRuling(value, frame),
    lighting: parseLighting(value.lighting),
    texture: parseTexture(value.texture),
  };
};
