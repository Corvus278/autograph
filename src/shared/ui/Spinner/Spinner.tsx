import { cx } from '@shared/lib/styles';
import type { FC } from 'react';

import type { SpinnerProps } from './Spinner.types';

/**
 * Индикатор ожидания: кольцо с бегущим сектором.
 *
 * Рисуется `currentColor` и размером шрифта не управляется — цвет берёт у
 * места, куда поставлен, а размер приходит классом. Своей палитры и своих
 * отступов у него нет: индикатор живёт внутри чужих контролов — кнопки,
 * плитки — и любые собственные поля двигали бы их содержимое.
 *
 * От читалки скрыт: о занятости сообщает сам контрол через `aria-busy`, а
 * вторая живая область на ту же мысль только удлинила бы озвучивание.
 */
export const Spinner: FC<SpinnerProps> = (props) => {
  const { className } = props;

  return (
    <svg
      className={cx('size-4 animate-spin', className)}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="8"
        cy="8"
        r="6"
        stroke="currentColor"
        strokeOpacity="0.3"
        strokeWidth="2"
      />

      <path
        d="M14 8a6 6 0 0 0-6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
};
