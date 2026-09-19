import type { ReactNode } from 'react';

export type AppHeaderProps = {
  /**
   * Действия экрана — например, отмена и повтор правок у генератора.
   * Встают между названием продукта и переходами между экранами.
   */
  actions?: ReactNode;
};
