import type { FC } from 'react';
import { useRef } from 'react';
import { Link } from 'react-router';

import { useGeneratorStore } from '../../model/useGeneratorStore';
import { usePageBackground } from '../../model/usePageBackground';
import { usePageLayout } from '../../model/usePageLayout';

import { PageNav } from './PageNav';
import { PagePreview } from './PagePreview';
import { SaveBar } from './SaveBar';
import { SettingsPanel } from './SettingsPanel';

/**
 * Экран генератора: слева предпросмотр страницы, справа панель настроек.
 */
export const Generator: FC = () => {
  const pageRef = useRef<HTMLDivElement>(null);
  const background = usePageBackground();
  const pages = usePageLayout(background.height);
  const pageIndex = useGeneratorStore((state) => {
    return state.pageIndex;
  });
  const page = pages[pageIndex] ?? pages[0] ?? { lines: [] };

  return (
    <main className="w-desktop mx-auto flex items-start gap-6 p-6">
      <section className="flex grow flex-col items-center gap-4">
        <Link
          to="/create-font"
          className="self-start text-sm text-violet-300 hover:text-violet-200"
        >
          Как создать свой шрифт
        </Link>

        <PagePreview pageRef={pageRef} page={page} background={background} />

        <PageNav pageCount={pages.length} />

        <SaveBar pageRef={pageRef} />
      </section>

      <SettingsPanel />
    </main>
  );
};
