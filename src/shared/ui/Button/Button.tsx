import { cx } from '@shared/lib/styles';
import type { FC } from 'react';

import { buttonVariants } from './Button.styles';
import type { ButtonProps } from './Button.types';

export const Button: FC<ButtonProps> = (props) => {
  const {
    children,
    onClick,
    variant,
    isDisabled = false,
    isLoading = false,
    describedBy,
    className,
  } = props;

  const handleButtonClick = () => {
    if (isLoading) {
      return;
    }

    onClick();
  };

  return (
    <button
      type="button"
      className={cx(buttonVariants({ variant }), className)}
      disabled={isDisabled}
      aria-busy={isLoading}
      aria-disabled={isLoading}
      aria-describedby={describedBy}
      onClick={handleButtonClick}
    >
      {/**
       * Подпись во время загрузки гасится прозрачностью, а не снимается и не
       * прячется `visibility`: кнопка держит прежнюю ширину, и соседи по
       * строке не прыгают, а читалка по-прежнему видит имя кнопки — скрытая
       * подпись оставила бы её безымянной.
       */}
      <span className={isLoading ? 'opacity-0' : undefined}>{children}</span>

      {isLoading && (
        <span
          className="absolute inset-0 flex items-center justify-center"
          aria-hidden="true"
        >
          {/**
           * Индикатор рисуется `currentColor`: цвет он берёт у своего вида
           * кнопки и не заводит собственной палитры.
           */}
          <svg className="size-4 animate-spin" viewBox="0 0 16 16" fill="none">
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
        </span>
      )}
    </button>
  );
};
