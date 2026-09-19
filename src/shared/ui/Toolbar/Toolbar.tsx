import * as RadixToolbar from '@radix-ui/react-toolbar';
import { cx } from '@shared/lib/styles';
import type { FC } from 'react';

import type { ToolbarProps } from './Toolbar.types';

/**
 * Панель — одна остановка табом: внутри фокус ходит стрелками, как
 * положено `role="toolbar"`, иначе шапка и панель просмотра съели бы
 * по табу на каждую иконку.
 */
export const Toolbar: FC<ToolbarProps> = (props) => {
  const { label, children, className } = props;

  return (
    <RadixToolbar.Root
      aria-label={label}
      orientation="horizontal"
      className={cx('flex items-center gap-1', className)}
    >
      {children}
    </RadixToolbar.Root>
  );
};
