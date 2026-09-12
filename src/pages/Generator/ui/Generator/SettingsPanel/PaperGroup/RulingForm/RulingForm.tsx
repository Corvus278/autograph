import { Button } from '@shared/ui/Button';
import type { FC } from 'react';
import { useState } from 'react';

import type { SheetRuling } from '../../../../../lib/paper';

import { NumberField } from './NumberField';
import type { ManualRuling, RulingFormProps, RulingFormValues } from './RulingForm.types';

/**
 * Форма листа, на котором шаг не найден. Поля тоже пустые: нулевое поле у
 * такого листа значит «не найдено», а не «поле нулевой ширины», и пустой ввод
 * при применении так же уходит в отступ по умолчанию.
 */
const EMPTY_FORM_VALUES: RulingFormValues = {
  step: '',
  firstLinePhase: '',
  marginTop: '',
  marginRight: '',
  marginBottom: '',
  marginLeft: '',
};

/**
 * Округление длины до сотых: измеритель выдаёт дробные пиксели, а поле ввода
 * с хвостом из пятнадцати знаков нечитаемо.
 */
const toFieldValue = (length: number): string => {
  return String(Math.round(length * 100) / 100);
};

/**
 * Число из введённой строки. Пустое поле и невнятный ввод — ноль: он же
 * означает «не задано» и для шага разлиновки, и для полей.
 */
const toLength = (value: string): number => {
  return Number.parseFloat(value) || 0;
};

/**
 * Начальное состояние формы — разлиновка самого листа: шаг, первая линия и
 * поля в пикселях его фотографии, как их нашли или поправили раньше.
 *
 * @param ruling — разлиновка экземпляра
 * @returns значения полей формы
 */
const toFormValues = (ruling: SheetRuling): RulingFormValues => {
  const { step, firstLinePhase, margins } = ruling;

  if (step <= 0) {
    return EMPTY_FORM_VALUES;
  }

  return {
    step: toFieldValue(step),
    firstLinePhase: toFieldValue(firstLinePhase),
    marginTop: toFieldValue(margins.top),
    marginRight: toFieldValue(margins.right),
    marginBottom: toFieldValue(margins.bottom),
    marginLeft: toFieldValue(margins.left),
  };
};

/**
 * Ручной ввод разлиновки: запасной путь, когда автоопределение не справилось,
 * и правка найденного, когда справилось не до конца.
 */
export const RulingForm: FC<RulingFormProps> = (props) => {
  const { ruling, onApply } = props;
  const [values, setValues] = useState<RulingFormValues>(() => {
    return toFormValues(ruling);
  });
  const hasDetection = ruling.step > 0;

  const handleStepChange = (step: string) => {
    setValues({ ...values, step });
  };

  const handleFirstLineChange = (firstLinePhase: string) => {
    setValues({ ...values, firstLinePhase });
  };

  const handleMarginTopChange = (marginTop: string) => {
    setValues({ ...values, marginTop });
  };

  const handleMarginRightChange = (marginRight: string) => {
    setValues({ ...values, marginRight });
  };

  const handleMarginBottomChange = (marginBottom: string) => {
    setValues({ ...values, marginBottom });
  };

  const handleMarginLeftChange = (marginLeft: string) => {
    setValues({ ...values, marginLeft });
  };

  const handleApplyClick = () => {
    const manual: ManualRuling = {
      step: toLength(values.step),
      firstLinePhase: toLength(values.firstLinePhase),
      margins: {
        top: toLength(values.marginTop),
        right: toLength(values.marginRight),
        bottom: toLength(values.marginBottom),
        left: toLength(values.marginLeft),
      },
    };

    onApply(manual);
  };

  return (
    <fieldset className="flex flex-col gap-3 rounded-md border border-zinc-700 p-3">
      <legend className="px-1 text-sm text-zinc-300">Разлиновка листа</legend>

      <p className="text-xs text-zinc-400">
        {hasDetection
          ? 'Найденные значения можно поправить: длины меряются по фотографии, в пикселях.'
          : 'Разлиновка не найдена. Задайте шаг, положение первой строки и поля вручную.'}
      </p>

      <NumberField
        label="Шаг строк, px"
        value={values.step}
        onChange={handleStepChange}
      />

      <NumberField
        label="Первая строка от верха, px"
        value={values.firstLinePhase}
        onChange={handleFirstLineChange}
      />

      <NumberField
        label="Верхнее поле, px"
        value={values.marginTop}
        onChange={handleMarginTopChange}
      />

      <NumberField
        label="Правое поле, px"
        value={values.marginRight}
        onChange={handleMarginRightChange}
      />

      <NumberField
        label="Нижнее поле, px"
        value={values.marginBottom}
        onChange={handleMarginBottomChange}
      />

      <NumberField
        label="Левое поле, px"
        value={values.marginLeft}
        onChange={handleMarginLeftChange}
      />

      <Button onClick={handleApplyClick}>Применить разлиновку</Button>
    </fieldset>
  );
};
