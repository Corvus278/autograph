import type { PageDirection, SpreadPair } from './spreadPages.types';

/**
 * Пара разворота, в которую входит страница: нечётная по счёту слева, чётная
 * справа. Последняя нечётная без пары стоит одна слева.
 *
 * @param pageIndex — номер страницы, считая с нуля
 * @param pageCount — число страниц прогона
 * @returns номера левой и правой страницы разворота
 */
export const getSpreadPair = (pageIndex: number, pageCount: number): SpreadPair => {
  const left = pageIndex - (pageIndex % 2);
  const right = left + 1;

  return { left, right: right < pageCount ? right : null };
};

/**
 * Вторая страница разворота, в который входит данная. Существует ли она,
 * решает число страниц — см. `getSpreadPair`.
 *
 * @param pageIndex — номер страницы, считая с нуля
 * @returns номер соседней по развороту страницы
 */
export const getPartnerIndex = (pageIndex: number): number => {
  return pageIndex % 2 === 0 ? pageIndex + 1 : pageIndex - 1;
};

/**
 * Страница после шага навигации. В развороте шаг — целый разворот, и
 * текущей становится его левая страница: так «вперёд» с правой страницы не
 * перескакивает через разворот.
 *
 * @param pageIndex — текущая страница, считая с нуля
 * @param direction — 1 вперёд, −1 назад
 * @param pageCount — число страниц прогона
 * @param isSpread — показываются ли развороты
 * @returns номер страницы после шага; шагать некуда — текущий номер
 */
export const stepPage = (
  pageIndex: number,
  direction: PageDirection,
  pageCount: number,
  isSpread: boolean
): number => {
  const start = isSpread ? pageIndex - (pageIndex % 2) : pageIndex;
  const next = start + direction * (isSpread ? 2 : 1);

  return next >= 0 && next < pageCount ? next : pageIndex;
};
