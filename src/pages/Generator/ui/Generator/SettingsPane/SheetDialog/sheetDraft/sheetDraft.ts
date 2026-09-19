import type { PaperMargins, PaperSheet, SheetRuling } from '../../../../../lib/paper';
import { buildSheetRuling, resolveSheetBounds } from '../../../../../lib/paper';

import type {
  ManualRuling,
  SheetBoundsValues,
  SheetDraft,
  SheetRulingValues,
} from './sheetDraft.types';

/**
 * Сколько долей пикселя различают поля диалога: длины показываются
 * округлёнными до сотых — измеритель выдаёт дробные пиксели, а поле с хвостом
 * из пятнадцати знаков нечитаемо.
 */
const FIELD_PRECISION = 100;

/**
 * Разлиновка листа, на котором шаг не найден. Поля тоже пустые: нулевое поле
 * у такого листа значит «не найдено», а не «поле нулевой ширины», и пустой
 * ввод при сохранении так же уходит в отступ по умолчанию.
 */
const EMPTY_RULING_VALUES: SheetRulingValues = {
  step: '',
  firstLinePhase: '',
  marginTop: '',
  marginRight: '',
  marginBottom: '',
  marginLeft: '',
};

/**
 * Длина так, как её показывает поле диалога.
 *
 * @param length — длина в пикселях фотографии
 * @returns длина, округлённая до сотых
 */
const toFieldPrecision = (length: number): number => {
  return Math.round(length * FIELD_PRECISION) / FIELD_PRECISION;
};

const toFieldValue = (length: number): string => {
  return String(toFieldPrecision(length));
};

/**
 * Число из введённой строки. Пустое поле и невнятный ввод — ноль: он же
 * значит «не задано» для шага и полей и «до края кадра» для границ.
 *
 * @param value — введённая строка
 * @returns длина в пикселях
 */
const toLength = (value: string): number => {
  return Number.parseFloat(value) || 0;
};

/**
 * Начальный черновик — характеристики самого листа: границы — прямоугольник,
 * вписанный в контур (в нём шло измерение), разлиновка — как её нашли или
 * поправили раньше.
 *
 * @param sheet — правимый лист
 * @param isBlank — лист добавлен без разлиновки
 * @returns черновик диалога
 */
export const toSheetDraft = (sheet: PaperSheet, isBlank: boolean): SheetDraft => {
  const { ruling, width, height } = sheet;
  const { top, right, bottom, left } = resolveSheetBounds(ruling.outline, width, height);
  const { step, firstLinePhase, margins } = ruling;

  return {
    bounds: {
      top: toFieldValue(top),
      right: toFieldValue(right),
      bottom: toFieldValue(bottom),
      left: toFieldValue(left),
    },
    ruling:
      step > 0
        ? {
            step: toFieldValue(step),
            firstLinePhase: toFieldValue(firstLinePhase),
            marginTop: toFieldValue(margins.top),
            marginRight: toFieldValue(margins.right),
            marginBottom: toFieldValue(margins.bottom),
            marginLeft: toFieldValue(margins.left),
          }
        : EMPTY_RULING_VALUES,
    isBlank,
  };
};

/**
 * Границы из черновика.
 *
 * @param values — границы в полях диалога
 * @returns отступы от краёв кадра в пикселях фотографии
 */
export const toSheetBounds = (values: SheetBoundsValues): PaperMargins => {
  return {
    top: toLength(values.top),
    right: toLength(values.right),
    bottom: toLength(values.bottom),
    left: toLength(values.left),
  };
};

/**
 * Разлиновка из черновика.
 *
 * @param values — разлиновка в полях диалога
 * @returns разлиновка, заданная руками
 */
export const toManualRuling = (values: SheetRulingValues): ManualRuling => {
  return {
    step: toLength(values.step),
    firstLinePhase: toLength(values.firstLinePhase),
    margins: {
      top: toLength(values.marginTop),
      right: toLength(values.marginRight),
      bottom: toLength(values.marginBottom),
      left: toLength(values.marginLeft),
    },
  };
};

/**
 * Разлиновка листа после ручной правки.
 *
 * Смещения изгиба и схождения перспективы отсчитаны от прямой гребёнки с
 * прежними шагом и фазой: с другими те же числа описывали бы другие прямые, и
 * строки встали бы мимо линий. Сравнение идёт с тем, что показало поле, а не с
 * измеренным: `47,93` из поля против `47,9312` стирало бы изгиб при правке
 * одних полей.
 *
 * Наклон и линию поля диалог не правит — они остаются найденными: иначе правка
 * полей молча стирала бы линию поля, и блок текста заезжал бы на неё. Контур
 * правка разлиновки не трогает — он про края листа, а не про гребёнку.
 *
 * @param sheet — правимый лист
 * @param manual — разлиновка из черновика
 * @returns новая разлиновка листа
 */
export const buildEditedRuling = (
  sheet: PaperSheet,
  manual: ManualRuling
): SheetRuling => {
  const {
    step,
    firstLinePhase,
    skewAngle,
    marginLineX,
    marginLineSide,
    bend,
    perspective,
    outline,
  } = sheet.ruling;
  const isCombKept =
    manual.step === toFieldPrecision(step) &&
    manual.firstLinePhase === toFieldPrecision(firstLinePhase);

  return buildSheetRuling(
    {
      ...manual,
      skewAngle,
      marginLineX,
      marginLineSide,
      bend: isCombKept ? bend : null,
      perspective: isCombKept ? perspective : null,
      outline,
    },
    sheet
  );
};
