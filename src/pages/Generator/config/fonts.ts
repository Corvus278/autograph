import type { HandwritingFont } from './config.types';

/**
 * Встроенные рукописные шрифты. Файлы лежат в `public/fonts`, объявления
 * `@font-face` — в `src/app/styles/app.css`: список и объявления правятся
 * вместе.
 */
export const HANDWRITING_FONTS: HandwritingFont[] = [
  { family: 'Abram', label: 'Абрам' },
  { family: 'Lexa', label: 'Лекса' },
  { family: 'Eskal', label: 'Эскаль' },
  { family: 'Stefano', label: 'Стефано' },
  { family: 'Pacifico', label: 'Пасифико' },
  { family: 'Lorenco', label: 'Лоренцо' },
  { family: 'Benvolio', label: 'Бенволио' },
  { family: 'Anselmo', label: 'Ансельмо' },
  { family: 'Capuletty', label: 'Капулетти' },
  { family: 'Djiovanni', label: 'Джованни' },
  { family: 'Gregory', label: 'Грегори' },
  { family: 'Montekky', label: 'Монтекки' },
  { family: 'Pag', label: 'Паг' },
  { family: 'Paris', label: 'Парис' },
  { family: 'Salavat', label: 'Салават' },
  { family: 'Samson', label: 'Самсон' },
];

/**
 * Имя семейства, под которым регистрируется загруженный пользователем `.ttf`.
 */
export const CUSTOM_FONT_FAMILY = 'UserFont';

/**
 * Шрифты, на которые подменяются отдельные буквы. Берём несколько соседних из
 * набора: подмена на слишком непохожее начертание читается как другой текст, а
 * не как неровный почерк.
 */
export const SUBSTITUTE_FONTS = ['Lexa', 'Eskal', 'Stefano', 'Lorenco'];
