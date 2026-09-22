/**
 * Версия приложения в Storybook и в прогонах stories — фиксированная.
 * Настоящая считает коммиты, и снятый с ней эталон шапки расходился бы после
 * каждого коммита, не проверяя при этом ни одной правки вёрстки.
 */
export const STORYBOOK_APP_VERSION = '0.1.0';

/**
 * Подстановка версии для vite. Лежит отдельно от `main.ts`, потому что
 * `viteFinal` — не единственный мыслимый потребитель: прогоны stories
 * и скриншотные тесты идут через `storybookTest`, который применяет тот же
 * `viteFinal`, и значение обязано быть у них одно с витриной.
 */
export const STORYBOOK_VERSION_DEFINE = {
  __APP_VERSION__: JSON.stringify(STORYBOOK_APP_VERSION),
};
