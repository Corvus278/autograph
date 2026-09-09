import type { RefObject } from 'react';

export type SaveBarProps = {
  /**
   * Узел страницы, с которого снимается PNG.
   */
  pageRef: RefObject<HTMLDivElement | null>;
};
