import type { RefObject } from 'react';

import type { Page } from '../../../lib/paginate/paginate.types';
import type { PageBackgroundView } from '../../../model/usePageBackground.types';

export type PagePreviewProps = {
  /**
   * Ссылка на узел страницы. По нему снимается PNG при сохранении, поэтому в
   * узел не попадает ничего из интерфейса.
   */
  pageRef: RefObject<HTMLDivElement | null>;

  /**
   * Страница, которую нужно отрисовать.
   */
  page: Page;

  /**
   * Фон листа и его размеры.
   */
  background: PageBackgroundView;
};
