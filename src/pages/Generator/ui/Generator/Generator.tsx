import { AppHeader } from '@widgets/AppHeader';
import type { FC } from 'react';

import { usePageLayout } from '../../model/usePageLayout';
import { usePageRender } from '../../model/usePageRender';
import { usePaperProfiles } from '../../model/usePaperProfiles';
import { useRunRender } from '../../model/useRunRender';
import { useStoredUserSheets } from '../../model/useStoredUserSheets';

import { ActionBar } from './ActionBar';
import { GeneratorLayout } from './GeneratorLayout';
import { HistoryControls } from './HistoryControls';
import { PageNav } from './PageNav';
import { PagePreview } from './PagePreview';
import { SettingsPanel } from './SettingsPanel';
import { TextPane } from './TextPane';
import { useHistoryHotkeys } from './useHistoryHotkeys';

/**
 * Экран генератора: текст слева, лист в центре, оформление справа, главные
 * действия — полосой внизу.
 */
export const Generator: FC = () => {
  usePaperProfiles();
  useStoredUserSheets();
  useHistoryHotkeys();

  const pages = usePageLayout();
  const source = usePageRender(pages);
  const plan = useRunRender(pages);

  return (
    <GeneratorLayout
      header={<AppHeader actions={<HistoryControls />} />}
      text={<TextPane pageCount={pages.length} />}
      viewport={
        <div className="flex flex-col items-center gap-4 p-6">
          <PagePreview source={source} />

          <PageNav pageCount={pages.length} />
        </div>
      }
      settings={
        <div className="p-4">
          <SettingsPanel />
        </div>
      }
      actions={<ActionBar plan={plan} />}
    />
  );
};
