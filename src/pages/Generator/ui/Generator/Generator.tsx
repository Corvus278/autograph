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
import { SettingsPane } from './SettingsPane';
import { getPartnerIndex, SheetViewport } from './SheetViewport';
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
  /**
   * Вторая страница разворота рисуется тем же путём, что и текущая: так она
   * совпадает с файлом, который сохранила бы, — вместе с зеркалом чётной.
   */
  const partnerSource = usePageRender(pages, getPartnerIndex(plan?.pageIndex || 0));

  return (
    <GeneratorLayout
      header={<AppHeader actions={<HistoryControls />} />}
      text={<TextPane pageCount={pages.length} />}
      viewport={
        <SheetViewport source={source} partnerSource={partnerSource} plan={plan} />
      }
      settings={<SettingsPane />}
      actions={<ActionBar plan={plan} />}
    />
  );
};
