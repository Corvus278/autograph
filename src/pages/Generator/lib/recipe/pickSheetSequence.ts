import { mulberry32, randomInt } from '@shared/lib/random';

import type { PaperSheet } from '../paper/paper.types';

/**
 * Шаг разведения подпотоков по страницам: множитель золотого сечения в 32
 * битах — соседние индексы страниц уводит в далёкие друг от друга состояния,
 * поэтому страницы не получают похожие последовательности.
 */
const PAGE_SEED_STRIDE = 0x9e_37_79_b9;

/**
 * Соль подпотока выбора листа. Своя соль на каждую постраничную величину:
 * иначе лист и контуры одной страницы черпались бы из одного состояния и
 * ходили бы парой.
 */
const SHEET_SALT = 0x5b_f0_36_35;

/**
 * Seed подпотока одной страницы. Постраничные величины выводятся не из общего
 * потока, а каждая из своего подпотока: тогда дописанная страница не сдвигает
 * то, что досталось предыдущим, и правка текста не меняет рецепт.
 *
 * @param seed — seed прогона
 * @param pageIndex — номер страницы, считая с нуля
 * @param salt — соль величины, ради которой берётся подпоток
 * @returns 32-битный seed подпотока
 */
export const toPageSeed = (seed: number, pageIndex: number, salt: number): number => {
  return (seed ^ Math.imul(pageIndex + 1, PAGE_SEED_STRIDE) ^ salt) >>> 0;
};

/**
 * Раздача экземпляров листов по страницам, которая наращивается по запросу:
 * лист страницы достраивает раздачу до неё и запоминает, поэтому проход по
 * страницам подряд линеен, а число страниц заранее знать не нужно.
 *
 * Соседним страницам достаются разные экземпляры, пока в семье есть из чего
 * выбирать. Правило соседства — против самого заметного признака подделки: две
 * подряд идущие страницы с одной и той же фотографией листа выдают, что бумага
 * нарисована, а не снята.
 *
 * Выбор страницы определяется её собственным подпотоком и листом предыдущей
 * страницы, поэтому раздача не зависит ни от порядка запросов, ни от того,
 * сколько страниц запросили.
 *
 * @param seed — seed прогона
 * @param sheets — экземпляры выбранной семьи
 * @returns лист страницы по её номеру; на пустой семье запрос отказывает
 */
export const createSheetSequence = (
  seed: number,
  sheets: PaperSheet[]
): ((pageIndex: number) => PaperSheet) => {
  const sequence: PaperSheet[] = [];

  return (pageIndex) => {
    while (sequence.length <= pageIndex) {
      const previous = sequence.at(-1);
      /**
       * На семье из одного экземпляра отбор соседа отсекает всё — тогда повтор
       * допускается: это не ошибка, а единственная возможность.
       */
      const candidates = sheets.filter((sheet) => {
        return sheet.id !== previous?.id;
      });
      const pool = candidates.length > 0 ? candidates : sheets;
      const random = mulberry32(toPageSeed(seed, sequence.length, SHEET_SALT));
      const picked = pool[randomInt(random, 0, pool.length - 1)];

      if (!picked) {
        throw new Error('Семья листов пуста: выбирать экземпляр не из чего');
      }

      sequence.push(picked);
    }

    const sheet = sequence[pageIndex];

    if (!sheet) {
      throw new Error(`Нет страницы с номером ${pageIndex}`);
    }

    return sheet;
  };
};

/**
 * Экземпляры листов для заданного числа страниц — начало раздачи
 * `createSheetSequence`: первые `n` элементов не зависят от того, сколько
 * страниц запросили.
 *
 * @param seed — seed прогона
 * @param sheets — экземпляры выбранной семьи; пустым список не бывает
 * @param pageCount — число страниц прогона
 * @returns экземпляры по страницам, по одному на страницу
 */
export const pickSheetSequence = (
  seed: number,
  sheets: PaperSheet[],
  pageCount: number
): PaperSheet[] => {
  const sheetAt = createSheetSequence(seed, sheets);

  return Array.from({ length: pageCount }, (_page, pageIndex) => {
    return sheetAt(pageIndex);
  });
};
