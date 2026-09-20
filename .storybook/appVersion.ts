/**
 * Версия приложения в Storybook и в прогонах stories — фиксированная.
 * Настоящая считает коммиты, и снятый с ней эталон шапки расходился бы после
 * каждого коммита, не проверяя при этом ни одной правки вёрстки.
 */
export const STORYBOOK_APP_VERSION = '1.0.0';

/**
 * Подстановка версии для vite: витрина и прогоны stories собираются разными
 * конфигами, и значение обязано быть в них одно.
 */
export const STORYBOOK_VERSION_DEFINE = {
  __APP_VERSION__: JSON.stringify(STORYBOOK_APP_VERSION),
};
