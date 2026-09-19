import { Dialog } from '@shared/ui/Dialog';
import type { FC } from 'react';
import { useShallow } from 'zustand/react/shallow';

import type { PaperMargins } from '../../../../lib/paper';
import { findFamily } from '../../../../model/paperSelectors';
import { useGeneratorStore } from '../../../../model/useGeneratorStore';
import { useManualRulingRequest } from '../../SettingsPanel/PaperGroup/useSheetImport';
import { useSheetRemeasure } from '../../SettingsPanel/PaperGroup/useSheetRemeasure';

import type { SheetDialogProps } from './SheetDialog.types';
import { SheetDialogForm } from './SheetDialogForm';
import type { ManualRuling } from './sheetDraft';
import { buildEditedRuling } from './sheetDraft';

/**
 * Диалог своего листа: фотография, границы листа на ней и разлиновка.
 *
 * Открывается кнопкой настройки на плитке листа и сам — когда на добавленной
 * фотографии автоопределение не нашло разлиновки. Правка разлиновки ложится
 * на лист только по «Сохранить»; перемер и удаление — отдельные действия со
 * своими кнопками и применяются сразу.
 */
export const SheetDialog: FC<SheetDialogProps> = (props) => {
  const { sheetId, onSheetIdChange } = props;
  const { record, presetFamilies } = useGeneratorStore(
    useShallow((state) => {
      return {
        record: state.userSheets.find(({ sheet }) => {
          return sheet.id === sheetId;
        }),
        presetFamilies: state.presetFamilies,
      };
    })
  );
  const addUserSheet = useGeneratorStore((state) => {
    return state.addUserSheet;
  });
  const removeUserSheet = useGeneratorStore((state) => {
    return state.removeUserSheet;
  });
  const sheetRemeasure = useSheetRemeasure(record?.sheet.id || '');

  useManualRulingRequest(onSheetIdChange);

  const family = record ? findFamily(presetFamilies, record.familyId) : undefined;

  const close = () => {
    onSheetIdChange(null);
  };

  const handleDialogOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      close();
    }
  };

  const handleRemeasure = (bounds: PaperMargins, isBlank: boolean) => {
    if (!record || !family) {
      return;
    }

    void sheetRemeasure.remeasure({ family, sheet: record.sheet, isBlank, bounds });
  };

  const handleSave = (manual: ManualRuling, isBlank: boolean) => {
    if (!record) {
      return;
    }

    const { familyId, sheet } = record;

    addUserSheet({
      familyId,
      sheet: { ...sheet, ruling: buildEditedRuling(sheet, manual) },
      isAnalyzed: true,
      isBlank,
    });
    close();
  };

  const handleDelete = () => {
    if (record) {
      removeUserSheet(record.sheet.id);
    }

    close();
  };

  const handleCancel = () => {
    close();
  };

  return (
    <Dialog
      isOpen={Boolean(record)}
      title={`Лист «${record?.sheet.label || ''}»`}
      description="Границы листа на фотографии и его разлиновка."
      onOpenChange={handleDialogOpenChange}
    >
      {record ? (
        <SheetDialogForm
          /**
           * Черновик берёт начальные значения из листа один раз, поэтому форма
           * пересоздаётся и по смене листа, и по перемеру: иначе после перемера
           * она показывала бы введённое до него, а не измеренное заново.
           */
          key={`${record.sheet.id}:${sheetRemeasure.revision}`}
          sheet={record.sheet}
          isBlank={record.isBlank}
          isRemeasuring={sheetRemeasure.isBusy}
          remeasureError={sheetRemeasure.error}
          onRemeasure={handleRemeasure}
          onSave={handleSave}
          onDelete={handleDelete}
          onCancel={handleCancel}
        />
      ) : null}
    </Dialog>
  );
};
