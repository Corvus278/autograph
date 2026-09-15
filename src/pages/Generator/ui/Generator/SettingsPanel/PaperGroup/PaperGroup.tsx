import { Checkbox } from '@shared/ui/Checkbox';
import { FileInput } from '@shared/ui/FileInput';
import { RadioGroup } from '@shared/ui/RadioGroup';
import type { FC } from 'react';
import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

import type { PaperSheet } from '../../../../lib/paper';
import { buildSheetRuling } from '../../../../lib/paper';
import { selectPageSheetId } from '../../../../model/recipeSelectors';
import { useGeneratorStore } from '../../../../model/useGeneratorStore';
import type { UserSheetRecord } from '../../../../model/userSheetsStorage.types';

import type { ManualRuling } from './RulingForm';
import { RulingForm } from './RulingForm';
import { UserSheetList } from './UserSheetList';
import { useSheetImport } from './useSheetImport';

/**
 * Сколько долей пикселя различает форма разлиновки: она показывает длины
 * округлёнными до сотых.
 */
const FORM_LENGTH_PRECISION = 100;

/**
 * Длина так, как её показала бы форма разлиновки (`RulingForm`): применённое
 * без правки поле возвращает ровно это число.
 *
 * @param length — длина в пикселях фотографии
 * @returns длина, округлённая до сотых
 */
const toFormPrecision = (length: number): number => {
  return Math.round(length * FORM_LENGTH_PRECISION) / FORM_LENGTH_PRECISION;
};

/**
 * Свои листы, добавленные в семью. Отдельным проходом, а не поиском по всем
 * семьям: панель показывает экземпляры только выбранной.
 *
 * @param records — все загруженные пользователем листы
 * @param familyId — семья, экземпляры которой нужны
 * @returns экземпляры семьи в порядке добавления
 */
const listOwnSheets = (records: UserSheetRecord[], familyId: string): PaperSheet[] => {
  return records.reduce<PaperSheet[]>((acc, record) => {
    if (record.familyId === familyId) {
      acc.push(record.sheet);
    }

    return acc;
  }, []);
};

/**
 * Группа «Бумага»: на чём пишем. Разлиновка у каждого экземпляра своя, поэтому
 * смена листа меняет не только фон, но и раскладку текста под его шаг и поля.
 *
 * Отмечен тот экземпляр, который сейчас на странице: пока пользователь не
 * выбрал лист сам, его выдаёт рецепт прогона, и панель обязана показывать
 * ровно то, что видно в предпросмотре. Выбор в списке закрепляет лист за всем
 * прогоном.
 */
export const PaperGroup: FC = () => {
  const { presetFamilies, userSheets, familyId, sheetId } = useGeneratorStore(
    useShallow((state) => {
      return {
        presetFamilies: state.presetFamilies,
        userSheets: state.userSheets,
        familyId: state.familyId,
        sheetId: selectPageSheetId(state, state.pageIndex),
      };
    })
  );
  const selectFamily = useGeneratorStore((state) => {
    return state.selectFamily;
  });
  const selectSheet = useGeneratorStore((state) => {
    return state.selectSheet;
  });
  const addUserSheet = useGeneratorStore((state) => {
    return state.addUserSheet;
  });
  const removeUserSheet = useGeneratorStore((state) => {
    return state.removeUserSheet;
  });
  const sheetImport = useSheetImport();
  const [isBlankSheet, setBlankSheet] = useState(false);

  const activeFamily =
    presetFamilies.find((family) => {
      return family.id === familyId;
    }) || presetFamilies[0];
  const ownSheets = activeFamily ? listOwnSheets(userSheets, activeFamily.id) : [];
  const sheets = activeFamily ? [...activeFamily.sheets, ...ownSheets] : [];
  const activeSheet =
    sheets.find((sheet) => {
      return sheet.id === sheetId;
    }) || sheets[0];
  const isOwnSheetSelected = ownSheets.some((sheet) => {
    return sheet.id === activeSheet?.id;
  });

  const handleFamilyChange = (value: string) => {
    selectFamily(value);
  };

  const handleSheetChange = (value: string) => {
    selectSheet(value);
  };

  const handleBlankSheetChange = (isChecked: boolean) => {
    setBlankSheet(isChecked);
  };

  const handleSheetFileSelect = (file: File) => {
    if (!activeFamily) {
      return;
    }

    void sheetImport.add(file, { family: activeFamily, isBlank: isBlankSheet });
  };

  const handleSheetRemove = (value: string) => {
    removeUserSheet(value);
  };

  const handleRulingApply = (manual: ManualRuling) => {
    if (!activeFamily || !activeSheet) {
      return;
    }

    const {
      step,
      firstLinePhase,
      skewAngle,
      marginLineX,
      marginLineSide,
      bend,
      perspective,
      outline,
    } = activeSheet.ruling;
    /**
     * Смещения изгиба отсчитаны от прямой гребёнки с прежними шагом и фазой: с
     * другими те же числа описывали бы отход от других прямых, и строки встали
     * бы мимо линий. Сравниваем с тем, что показала форма, а не с измеренным:
     * `47,93` из формы против `47,9312` стирало бы изгиб при правке одних полей.
     */
    const isCombKept =
      manual.step === toFormPrecision(step) &&
      manual.firstLinePhase === toFormPrecision(firstLinePhase);
    /**
     * Наклон и линию поля форма не правит — они остаются найденными: иначе
     * правка полей молча стирала бы линию поля, и блок текста заезжал бы на
     * неё.
     */
    const ruling = buildSheetRuling(
      {
        ...manual,
        skewAngle,
        marginLineX,
        marginLineSide,
        bend: isCombKept ? bend : null,
        /**
         * Перспектива держится того же правила, что и изгиб: она описывает ту
         * же гребёнку, и с другими шагом и фазой линии по ней встали бы мимо.
         * Контур правка не трогает — он про края листа, а не про гребёнку.
         */
        perspective: isCombKept ? perspective : null,
        outline,
      },
      activeSheet
    );

    addUserSheet({
      familyId: activeFamily.id,
      sheet: { ...activeSheet, ruling },
      isAnalyzed: true,
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <RadioGroup
        label="Семья листов"
        value={activeFamily?.id || ''}
        options={presetFamilies.map(({ id, label }) => {
          return { value: id, label };
        })}
        onChange={handleFamilyChange}
      />

      <RadioGroup
        label="Экземпляр листа"
        value={activeSheet?.id || ''}
        options={sheets.map(({ id, label }) => {
          return { value: id, label };
        })}
        onChange={handleSheetChange}
      />

      <Checkbox
        label="Лист без разлиновки"
        isChecked={isBlankSheet}
        onChange={handleBlankSheetChange}
      />

      <FileInput
        label="Своя фотография листа"
        accept="image/*"
        error={sheetImport.error}
        isDisabled={sheetImport.isBusy}
        onSelect={handleSheetFileSelect}
      />

      {sheetImport.isBusy ? (
        <p className="text-xs text-zinc-400">Разбираем фотографию…</p>
      ) : null}

      <UserSheetList sheets={ownSheets} onRemove={handleSheetRemove} />

      {activeFamily && activeSheet && isOwnSheetSelected ? (
        <RulingForm
          key={activeSheet.id}
          ruling={activeSheet.ruling}
          onApply={handleRulingApply}
        />
      ) : null}
    </div>
  );
};
