import { cx } from '@shared/lib/styles';
import { cva } from 'class-variance-authority';
import type { FC } from 'react';

import type { ButtonProps } from './Button.types';

const button = cva(
  'inline-flex cursor-pointer items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400 disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-violet-600 text-white hover:bg-violet-500',
        secondary: 'bg-zinc-800 text-zinc-100 hover:bg-zinc-700',
        ghost: 'bg-transparent text-zinc-300 hover:bg-zinc-800',
      },
    },
    defaultVariants: {
      variant: 'secondary',
    },
  }
);

export const Button: FC<ButtonProps> = (props) => {
  const { children, onClick, variant, isDisabled = false, className } = props;

  const handleButtonClick = () => {
    onClick();
  };

  return (
    <button
      type="button"
      className={cx(button({ variant }), className)}
      disabled={isDisabled}
      onClick={handleButtonClick}
    >
      {children}
    </button>
  );
};
