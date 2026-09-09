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
    <main className="mx-auto flex w-3xl flex-col gap-8 p-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Как создать шрифт онлайн</h1>

        <p className="text-zinc-400">
          Шесть шагов — от шаблона до готового файла TTF или WOFF2.
        </p>
      </header>

      <ol className="flex flex-col gap-4">
        {CREATE_FONT_STEPS.map(({ number, title, text }) => {
          return (
            <li
              key={number}
              className="rounded-md border border-zinc-800 bg-zinc-900 p-4"
            >
              <h2 className="text-sm font-medium text-zinc-200">
                {number}. {title}
              </h2>

              <p className="pt-1 text-sm text-zinc-400">{text}</p>
            </li>
          );
        })}
      </ol>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Частые вопросы</h2>

        {CREATE_FONT_QUESTIONS.map(({ question, answer }) => {
          return (
            <div key={question} className="flex flex-col gap-1">
              <h3 className="text-sm font-medium text-zinc-200">{question}</h3>

              <p className="text-sm text-zinc-400">{answer}</p>
            </div>
          );
        })}
      </section>

      <footer className="flex items-center gap-4">
        <a
          href={FONT_GENERATOR_URL}
          target="_blank"
          rel="noreferrer"
          className="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
        >
          Создать шрифт
        </a>

        <Link to="/" className="text-sm text-violet-300 hover:text-violet-200">
          Вернуться к генератору
        </Link>
      </footer>
    </main>
  );
};
