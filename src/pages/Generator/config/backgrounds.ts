import type { PageBackground, Scene } from './config.types';

/**
 * Встроенные фоны листа. Размеры — настоящие размеры файлов в `public`.
 */
export const PAGE_BACKGROUNDS: PageBackground[] = [
  {
    id: 'grid',
    label: 'Тетрадный лист в клетку',
    src: '/33.jpg',
    width: 1871,
    height: 2394,
  },
  {
    id: 'lined',
    label: 'Тетрадный лист в линейку',
    src: '/line.jpg',
    width: 775,
    height: 1000,
  },
  {
    id: 'blank',
    label: 'Чистый лист',
    src: '/page_3.png',
    width: 731,
    height: 928,
  },
];

/**
 * Встроенные сцены, в которые вкладывается снимок страницы при сохранении.
 */
export const SCENES: Scene[] = [
  { id: 'desk', label: 'Стол', src: '/bg7.jpg' },
  { id: 'notebook', label: 'Тетрадь', src: '/bg10.jpg' },
];
