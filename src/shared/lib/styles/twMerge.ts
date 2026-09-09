import { extendTailwindMerge } from 'tailwind-merge';

/**
 * `tailwind-merge` знает только стандартные значения Tailwind. Токены из
 * `@theme` для него — незнакомые классы, и конфликтующими он их не считает,
 * поэтому перечисляем их сами.
 */
export const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      w: ['w-desktop'],
      'min-w': ['min-w-desktop'],
      'max-w': ['max-w-desktop'],
    },
  },
});
