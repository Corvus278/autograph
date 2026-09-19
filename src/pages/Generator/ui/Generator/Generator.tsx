import type { FC } from 'react';
import { Link } from 'react-router';

import { usePageLayout } from '../../model/usePageLayout';
import { usePageRender } from '../../model/usePageRender';
import { usePaperProfiles } from '../../model/usePaperProfiles';
import { useRunRender } from '../../model/useRunRender';
import { useStoredUserSheets } from '../../model/useStoredUserSheets';

import { PageNav } from './PageNav';
import { PagePreview } from './PagePreview';
import { SaveBar } from './SaveBar';
import { SettingsPanel } from './SettingsPanel';

/**
 * Экран генератора: слева предпросмотр страницы, справа панель настроек.
 */
export const Generator: FC = () => {
  usePaperProfiles();
  useStoredUserSheets();

  const pages = usePageLayout();
  const source = usePageRender(pages);
  const plan = useRunRender(pages);

  return (
    <main className="mx-auto flex w-desktop items-start gap-6 p-6">
      <section className="flex grow flex-col items-center gap-4">
        <Link
          to="/create-font"
          className="self-start text-sm text-violet-300 hover:text-violet-200"
        >
          Как создать свой шрифт
        </Link>

        <PagePreview source={source} />

        <PageNav pageCount={pages.length} />

        <SaveBar plan={plan} />
      </section>

      <SettingsPanel />
    </main>
  );
};
