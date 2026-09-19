import { Button } from '@shared/ui/Button';
import { Checkbox } from '@shared/ui/Checkbox';
import type { FC } from 'react';
import { useState } from 'react';

import { LengthField } from '../LengthField';
import type { SheetBoundsValues, SheetDraft, SheetRulingValues } from '../sheetDraft';
import { toManualRuling, toSheetBounds, toSheetDraft } from '../sheetDraft';

import type { SheetDialogFormProps } from './SheetDialogForm.types';

const FIELDSET_CLASS_NAME = 'flex flex-col gap-3 rounded-md border border-border p-3';

const LEGEND_CLASS_NAME =
  'px-1 text-xs font-semibold tracking-wider text-fg-muted uppercase';

const HINT_CLASS_NAME = 'text-xs text-fg-muted';

/**
 * Содержимое диалога своего листа: фотография, границы и разлиновка в
 * черновике, перемер и удаление.
 *
 * Черновик живёт только здесь: лист меняется по «Сохранить», по перемеру и по
 * подтверждённому удалению, а закрытие диалога черновик выбрасывает.
 */
export const SheetDialogForm: FC<SheetDialogFormProps> = (props) => {
  const {
    sheet,
    isBlank,
    isRemeasuring,
    remeasureError,
    onRemeasure,
    onSave,
    onDelete,
    onCancel,
  } = props;
  const [draft, setDraft] = useState<SheetDraft>(() => {
    return toSheetDraft(sheet, isBlank);
  });
  const [isDeleteConfirming, setDeleteConfirming] = useState(false);
  const { bounds, ruling } = draft;
  const hasDetection = sheet.ruling.step > 0;

  const changeBounds = (patch: Partial<SheetBoundsValues>) => {
    setDraft({ ...draft, bounds: { ...bounds, ...patch } });
  };

  const changeRuling = (patch: Partial<SheetRulingValues>) => {
    setDraft({ ...draft, ruling: { ...ruling, ...patch } });
  };

  const handleBlankChange = (isChecked: boolean) => {
    setDraft({ ...draft, isBlank: isChecked });
  };

  const handleBoundsTopChange = (top: string) => {
    changeBounds({ top });
  };

  const handleBoundsRightChange = (right: string) => {
    changeBounds({ right });
  };

  const handleBoundsBottomChange = (bottom: string) => {
    changeBounds({ bottom });
  };

  const handleBoundsLeftChange = (left: string) => {
    changeBounds({ left });
  };

  const handleStepChange = (step: string) => {
    changeRuling({ step });
  };

  const handleFirstLineChange = (firstLinePhase: string) => {
    changeRuling({ firstLinePhase });
  };

  const handleMarginTopChange = (marginTop: string) => {
    changeRuling({ marginTop });
  };

  const handleMarginRightChange = (marginRight: string) => {
    changeRuling({ marginRight });
  };

  const handleMarginBottomChange = (marginBottom: string) => {
    changeRuling({ marginBottom });
  };

  const handleMarginLeftChange = (marginLeft: string) => {
    changeRuling({ marginLeft });
  };

  const handleRemeasureClick = () => {
    onRemeasure(toSheetBounds(bounds), draft.isBlank);
  };

  const handleDeleteClick = () => {
    setDeleteConfirming(true);
  };

  const handleDeleteConfirmClick = () => {
    onDelete();
  };

  const handleDeleteCancelClick = () => {
    setDeleteConfirming(false);
  };

  const handleCancelClick = () => {
    onCancel();
  };

  const handleSaveClick = () => {
    onSave(toManualRuling(ruling), draft.isBlank);
  };

  return (
    <div className="flex flex-col gap-4">
      <img
        src={sheet.src}
        alt={`Фотография листа «${sheet.label}»`}
        className="max-h-64 w-full rounded-md bg-canvas object-contain"
      />

      <Checkbox
        label="Лист без разлиновки"
        isChecked={draft.isBlank}
        onChange={handleBlankChange}
      />

      <fieldset className={FIELDSET_CLASS_NAME}>
        <legend className={LEGEND_CLASS_NAME}>Границы листа</legend>

        <p className={HINT_CLASS_NAME}>
          Отступы листа от краёв фотографии в пикселях. Лист перемеряется внутри них
          заново, ручная правка разлиновки при этом заменяется.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <LengthField
            label="Граница сверху, px"
            value={bounds.top}
            onChange={handleBoundsTopChange}
          />

          <LengthField
            label="Граница справа, px"
            value={bounds.right}
            onChange={handleBoundsRightChange}
          />

          <LengthField
            label="Граница снизу, px"
            value={bounds.bottom}
            onChange={handleBoundsBottomChange}
          />

          <LengthField
            label="Граница слева, px"
            value={bounds.left}
            onChange={handleBoundsLeftChange}
          />
        </div>

        {remeasureError ? (
          <p role="alert" className="text-xs text-danger">
            {remeasureError}
          </p>
        ) : null}

        {isRemeasuring ? (
          <p role="status" className={HINT_CLASS_NAME}>
            Перемеряем лист…
          </p>
        ) : null}

        <Button
          variant="secondary"
          isDisabled={isRemeasuring}
          onClick={handleRemeasureClick}
        >
          Перемерить
        </Button>
      </fieldset>

      <fieldset className={FIELDSET_CLASS_NAME}>
        <legend className={LEGEND_CLASS_NAME}>Разлиновка</legend>

        <p className={HINT_CLASS_NAME}>
          {hasDetection
            ? 'Найденные значения можно поправить: длины меряются по фотографии, в пикселях.'
            : 'Разлиновка не найдена. Задайте шаг, положение первой строки и поля вручную.'}
        </p>

        <div className="grid grid-cols-2 gap-3">
          <LengthField
            label="Шаг строк, px"
            value={ruling.step}
            min={0}
            onChange={handleStepChange}
          />

          <LengthField
            label="Первая строка от верха, px"
            value={ruling.firstLinePhase}
            min={0}
            onChange={handleFirstLineChange}
          />

          <LengthField
            label="Верхнее поле, px"
            value={ruling.marginTop}
            min={0}
            onChange={handleMarginTopChange}
          />

          <LengthField
            label="Правое поле, px"
            value={ruling.marginRight}
            min={0}
            onChange={handleMarginRightChange}
          />

          <LengthField
            label="Нижнее поле, px"
            value={ruling.marginBottom}
            min={0}
            onChange={handleMarginBottomChange}
          />

          <LengthField
            label="Левое поле, px"
            value={ruling.marginLeft}
            min={0}
            onChange={handleMarginLeftChange}
          />
        </div>
      </fieldset>

      {isDeleteConfirming ? (
        <div
          role="group"
          aria-label="Подтверждение удаления"
          className="flex flex-col gap-2 rounded-md border border-danger p-3"
        >
          <p className="text-sm text-fg">
            Удалить «{sheet.label}» из бумаги и из хранилища браузера?
          </p>

          <div className="flex gap-2">
            <Button variant="secondary" onClick={handleDeleteConfirmClick}>
              Да, удалить
            </Button>

            <Button variant="ghost" onClick={handleDeleteCancelClick}>
              Не удалять
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          isDisabled={isDeleteConfirming}
          onClick={handleDeleteClick}
        >
          Удалить лист
        </Button>

        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleCancelClick}>
            Отмена
          </Button>

          <Button isDisabled={isRemeasuring} onClick={handleSaveClick}>
            Сохранить
          </Button>
        </div>
      </div>
    </div>
  );
};
