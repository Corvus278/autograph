import { AppHeader } from '@widgets/AppHeader';
import type { FC } from 'react';
import { Link } from 'react-router';

import {
  CREATE_FONT_QUESTIONS,
  CREATE_FONT_STEPS,
  FONT_GENERATOR_URL,
} from '../../config';

/**
 * Статичная инструкция: как получить свой рукописный шрифт. Сам шрифт собирает
 * внешний сервис, генератор только объясняет порядок действий.
 */
export const CreateFont: FC = () => {
  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader />

      <main className="mx-auto flex w-3xl flex-col gap-8 p-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold">Как создать шрифт онлайн</h1>

          <p className="text-fg-muted">
            Шесть шагов — от шаблона до готового файла TTF или WOFF2.
          </p>
        </div>

        <ol className="flex flex-col gap-4">
          {CREATE_FONT_STEPS.map(({ number, title, text }) => {
            return (
              <li
                key={number}
                className="rounded-md border border-border bg-surface-raised p-4"
              >
                <h2 className="text-sm font-medium text-fg">
                  {number}. {title}
                </h2>

                <p className="pt-1 text-sm text-fg-muted">{text}</p>
              </li>
            );
          })}
        </ol>

        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold">Частые вопросы</h2>

          {CREATE_FONT_QUESTIONS.map(({ question, answer }) => {
            return (
              <div key={question} className="flex flex-col gap-1">
                <h3 className="text-sm font-medium text-fg">{question}</h3>

                <p className="text-sm text-fg-muted">{answer}</p>
              </div>
            );
          })}
        </section>

        <footer className="flex items-center gap-4">
          <a
            href={FONT_GENERATOR_URL}
            target="_blank"
            rel="noreferrer"
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-fg transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            Создать шрифт
          </a>

          <Link
            to="/"
            className="rounded-sm text-sm text-fg-muted underline underline-offset-2 hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            Вернуться к генератору
          </Link>
        </footer>
      </main>
    </div>
  );
};
