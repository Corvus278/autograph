import type { FC } from 'react';

import type { GeneratorLayoutProps } from './GeneratorLayout.types';

/**
 * Каркас экрана генератора: шапка, три колонки и полоса действий.
 *
 * Каркас ровно в высоту окна, прокручиваются колонки, а не страница: так
 * полоса действий видна при любой прокрутке без `position: fixed`, а
 * прокрутка текста или настроек не двигает лист. Ширину окна держит
 * `min-width` у `html`: в окне уже порога страница прокручивается по
 * горизонтали, а колонки не сжимаются.
 *
 * Колонка настроек — ровно по своему токену: длинная подпись или раскрытая
 * экспертная группа иначе раздвигали бы колонку и сжимали лист.
 */
export const GeneratorLayout: FC<GeneratorLayoutProps> = (props) => {
  const { header, text, viewport, settings, actions } = props;

  return (
    <div className="flex h-dvh flex-col">
      {header}

      <main className="flex min-h-0 flex-1">
        <div className="flex w-text-panel shrink-0 flex-col border-r border-border bg-surface p-4">
          {text}
        </div>

        <div className="relative min-w-0 flex-1 overflow-auto bg-canvas">{viewport}</div>

        <div className="w-settings-panel shrink-0 overflow-y-auto border-l border-border bg-surface">
          {settings}
        </div>
      </main>

      <div className="flex min-h-action-bar shrink-0 items-center border-t border-border bg-surface px-4">
        {actions}
      </div>
    </div>
  );
};
