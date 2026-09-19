import type { ReactNode } from 'react';

export type ToolbarProps = {
  /**
   * Доступное имя панели.
   */
  label: string;

  /**
   * Пункты панели — `ToolbarItem` и разделители.
   */
  children: ReactNode;

  /**
   * Дополнительные классы.
   */
  className?: string;
};
