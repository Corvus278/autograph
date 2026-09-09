import type { ClassValue } from 'clsx';
import clsx from 'clsx';

import { twMerge } from './twMerge';

/**
 * Склеивает классы: `clsx` разбирает условия, `twMerge` схлопывает
 * конфликтующие классы одной группы. Без второго шага внешний `className`
 * не перекрывал бы дефолт компонента — побеждал бы тот класс, что позже в CSS.
 */
export const cx = (...args: ClassValue[]): string => {
  return twMerge(clsx(args));
};
