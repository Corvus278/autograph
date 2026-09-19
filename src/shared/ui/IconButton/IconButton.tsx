import { cx } from '@shared/lib/styles';
import type { FC } from 'react';

import { Tooltip } from '../Tooltip';

import type { IconButtonProps } from './IconButton.types';

/**
 * Остальные атрибуты уходят на `<button>` как есть: так кнопку можно
 * вложить в `ToolbarItem`, который вешает на неё роуминг фокуса.
 */
export const IconButton: FC<IconButtonProps> = (props) => {
  const {
    label,
    children,
    onClick,
    isDisabled = false,
    className,
    ...buttonProps
  } = props;

  const handleButtonClick = () => {
    onClick();
  };

  return (
    <Tooltip content={label}>
      <button
        {...buttonProps}
        type="button"
        aria-label={label}
        disabled={isDisabled}
        className={cx(
          'inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-surface-raised hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:size-4',
          className
        )}
        onClick={handleButtonClick}
      >
        {children}
      </button>
    </Tooltip>
  );
};
