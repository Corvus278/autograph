import * as RadixToolbar from '@radix-ui/react-toolbar';
import type { FC } from 'react';

import type { ToolbarItemProps } from './ToolbarItem.types';

/**
 * Включает кнопку в роуминг фокуса панели, не меняя её вида.
 */
export const ToolbarItem: FC<ToolbarItemProps> = (props) => {
  const { children } = props;

  return <RadixToolbar.Button asChild>{children}</RadixToolbar.Button>;
};
