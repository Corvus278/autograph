/**
 * Адрес файла из `public` с учётом базового пути сборки.
 *
 * Сайт может раздаваться из подпапки (GitHub Pages отдаёт проект по
 * `/<репозиторий>/`), а пути в коде и в артефакте профилей записаны от корня.
 * Vite переписывает такие пути сам только в CSS и `index.html` — строки в коде
 * и адреса из JSON он не видит.
 *
 * @param path — путь от корня сайта, например `/fonts/Abram.ttf`
 * @returns путь с базовым префиксом сборки
 */
export const withBasePath = (path: string): string => {
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`;
};
