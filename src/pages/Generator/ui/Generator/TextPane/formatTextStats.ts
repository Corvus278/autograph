/**
 * Неразрывный пробел: между разрядами и между числом и словом подпись не
 * должна рваться переносом.
 */
const NBSP = ' ';

/**
 * Граница каждой тройки разрядов, считая справа.
 */
const DIGIT_GROUP_PATTERN = /\B(?=(\d{3})+(?!\d))/g;

const PLURAL_RULES = new Intl.PluralRules('ru-RU');

/**
 * Формы слова для целого числа по правилу множественного числа.
 */
type WordForms = Record<Intl.LDMLPluralRule, string>;

const CHARACTER_FORMS: WordForms = {
  zero: 'знаков',
  one: 'знак',
  two: 'знака',
  few: 'знака',
  many: 'знаков',
  other: 'знаков',
};

const PAGE_FORMS: WordForms = {
  zero: 'страниц',
  one: 'страница',
  two: 'страницы',
  few: 'страницы',
  many: 'страниц',
  other: 'страниц',
};

/**
 * Разряды делятся и у четырёхзначных чисел: `Intl` для русской локали
 * оставляет «1240» слитно, а рядом с «12 400» это читается как другая запись.
 *
 * @param value — неотрицательное целое
 * @param forms — формы слова
 * @returns например «1 240 знаков»
 */
const formatCount = (value: number, forms: WordForms): string => {
  const number = String(value).replace(DIGIT_GROUP_PATTERN, NBSP);

  return `${number}${NBSP}${forms[PLURAL_RULES.select(value)]}`;
};

/**
 * @param count — число знаков текста
 * @returns например «1 240 знаков»
 */
export const formatCharacterCount = (count: number): string => {
  return formatCount(count, CHARACTER_FORMS);
};

/**
 * @param count — число страниц прогона
 * @returns например «12 страниц»
 */
export const formatPageCount = (count: number): string => {
  return formatCount(count, PAGE_FORMS);
};
