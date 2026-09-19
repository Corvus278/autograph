import type { NumberFormatOptions } from './format.types';

/**
 * Неразрывный пробел между числом и единицей: подпись не должна рваться
 * переносом посередине.
 */
export const NBSP = ' ';

/**
 * Типографский минус. `Intl` для русской локали ставит дефис-минус, а рядом с
 * плюсом той же ширины он выглядит короткой чёрточкой.
 */
const MINUS = '−';

const HYPHEN_MINUS = '-';

/**
 * Записывает число по-русски: запятая в дроби, неразрывный пробел в разрядах,
 * типографский минус. Число, которое после округления стало нулём, пишется
 * как `0` без знака — «−0» пользователю ничего не говорит.
 *
 * @param value — число
 * @param options — точность и признак знака у положительных
 * @returns запись числа без единицы
 */
export const formatNumber = (value: number, options: NumberFormatOptions): string => {
  const { fractionDigits, isSigned } = options;
  const formatter = new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: fractionDigits,
    signDisplay: isSigned ? 'exceptZero' : 'auto',
  });

  /**
   * `|| 0` превращает `-0` в `0`: иначе `auto` напечатал бы «−0».
   */
  const rounded = roundTo(value, fractionDigits) || 0;

  return formatter.format(rounded).replace(HYPHEN_MINUS, MINUS);
};

/**
 * Округляет так же, как запись числа, чтобы согласование единицы шло по
 * показанному значению, а не по исходному.
 *
 * @param value — число
 * @param fractionDigits — знаков после запятой
 * @returns округлённое число
 */
export const roundTo = (value: number, fractionDigits: number): number => {
  const scale = 10 ** fractionDigits;

  return Math.round(value * scale) / scale;
};
