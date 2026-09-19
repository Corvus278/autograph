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
    describedBy,
    className,
  } = props;

  const handleButtonClick = () => {
    onClick();
  };

  return (
    <button
      type="button"
      className={cx(buttonVariants({ variant }), className)}
      disabled={isDisabled}
      aria-describedby={describedBy}
      onClick={handleButtonClick}
    >
      {children}
    </button>
  );
};
