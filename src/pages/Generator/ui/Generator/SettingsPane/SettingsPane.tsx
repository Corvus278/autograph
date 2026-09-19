import type { FC } from 'react';
import { useCallback, useState } from 'react';

import { ExpertSettings } from './ExpertSettings';
import { HandwritingPicker } from './HandwritingPicker';
import { InkPicker } from './InkPicker';
import { PaperPicker } from './PaperPicker';
import { RealismPicker } from './RealismPicker';
import { SheetDialog } from './SheetDialog';

/**
 * Колонка оформления: основной путь — бумага, почерк, чернила, реализм — и
 * свёрнутый под ним экспертный режим.
 *
 * Диалог своего листа один на колонку и держит открытый лист здесь: его
 * открывают и кнопка настройки на плитке, и неудачный импорт фотографии, а
 * второй экземпляр диалога открылся бы на ту же просьбу поверх первого.
 */
export const SettingsPane: FC = () => {
  const [dialogSheetId, setDialogSheetId] = useState<string | null>(null);

  /**
   * Стабильный колбэк: диалог подписывается им на просьбы импорта, и новый
   * колбэк на каждый рендер переподключал бы подписку.
   */
  const handleSheetIdChange = useCallback((sheetId: string | null) => {
    setDialogSheetId(sheetId);
  }, []);

  const handleSheetSettingsOpen = (sheetId: string) => {
    setDialogSheetId(sheetId);
  };

  return (
    <div className="flex flex-col gap-6 p-4">
      <PaperPicker onSheetSettingsOpen={handleSheetSettingsOpen} />

      <HandwritingPicker />

      <InkPicker />

      <RealismPicker />

      <ExpertSettings />

      <SheetDialog sheetId={dialogSheetId} onSheetIdChange={handleSheetIdChange} />
    </div>
  );
};
