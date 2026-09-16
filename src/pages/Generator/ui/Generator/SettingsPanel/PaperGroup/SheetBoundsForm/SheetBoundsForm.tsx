import { Button } from '@shared/ui/Button';
import type { FC } from 'react';
import { useState } from 'react';

import type { PaperSheet } from '../../../../../lib/paper';
import { resolveSheetBounds } from '../../../../../lib/paper';

import { BoundsField } from './BoundsField';
import type {
  SheetBoundsFormProps,
  SheetBoundsFormValues,
} from './SheetBoundsForm.types';

/**
 * Округление длины до сотых: контур хранится дробными пикселями, а поле ввода
 * с хвостом из пятнадцати знаков нечитаемо.
 *
 * @param length — длина в пикселях фотографии
 * @returns строка для поля
 */
const toFieldValue = (length: number): string => {
  return String(Math.round(length * 100) / 100);
};

/**
 * Число из введённой строки. Пустое поле — ноль: лист доходит до края кадра.
 *
 * @param value — введённая строка
 * @returns длина в пикселях
 */
const toLength = (value: string): number => {
  return Number.parseFloat(value) || 0;
};

/**
 * Начальное состояние формы — прямоугольник, вписанный в контур листа: в нём
 * шло измерение, и его же пользователь правит.
 *
 * @param sheet — правимый лист
 * @returns значения полей формы
 */
const toFormValues = (sheet: PaperSheet): SheetBoundsFormValues => {
  const { top, right, bottom, left } = resolveSheetBounds(
    sheet.ruling.outline,
    sheet.width,
    sheet.height
  );

  return {
    top: toFieldValue(top),
    right: toFieldValue(right),
    bottom: toFieldValue(bottom),
    left: toFieldValue(left),
  };
};

/**
 * Границы листа на фотографии: запасной путь, когда автопоиск контура ошибся.
 * Применение перемеряет лист внутри границ, а не подставляет их в разлиновку.
 */
export const SheetBoundsForm: FC<SheetBoundsFormProps> = (props) => {
  const { sheet, isBusy, error, onApply } = props;
  const [values, setValues] = useState<SheetBoundsFormValues>(() => {
    return toFormValues(sheet);
  });

  const handleTopChange = (top: string) => {
    setValues({ ...values, top });
  };

  const handleRightChange = (right: string) => {
    setValues({ ...values, right });
  };

  const handleBottomChange = (bottom: string) => {
    setValues({ ...values, bottom });
  };

  const handleLeftChange = (left: string) => {
    setValues({ ...values, left });
  };

  const handleApplyClick = () => {
    onApply({
      top: toLength(values.top),
      right: toLength(values.right),
      bottom: toLength(values.bottom),
      left: toLength(values.left),
    });
  };

  return (
    <fieldset className="flex flex-col gap-3 rounded-md border border-zinc-700 p-3">
      <legend className="px-1 text-sm text-zinc-300">Границы листа</legend>

      <p className="text-xs text-zinc-400">
        Отступы листа от краёв фотографии в пикселях. Лист перемеряется внутри них заново,
        ручная правка разлиновки при этом заменяется.
      </p>

      <BoundsField
        label="Граница сверху, px"
        value={values.top}
        onChange={handleTopChange}
      />

      <BoundsField
        label="Граница справа, px"
        value={values.right}
        onChange={handleRightChange}
      />

      <BoundsField
        label="Граница снизу, px"
        value={values.bottom}
        onChange={handleBottomChange}
      />

      <BoundsField
        label="Граница слева, px"
        value={values.left}
        onChange={handleLeftChange}
      />

      {error ? (
        <p role="alert" className="text-xs text-red-400">
          {error}
        </p>
      ) : null}

      {isBusy ? <p className="text-xs text-zinc-400">Перемеряем лист…</p> : null}

      <Button isDisabled={isBusy} onClick={handleApplyClick}>
        Перемерить в границах
      </Button>
    </fieldset>
  );
};
