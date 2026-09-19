import { withBasePath } from '@shared/lib/url';

import type { Scene } from './config.types';

/**
 * Встроенные сцены, в которые вкладывается снимок страницы при сохранении.
 */
export const SCENES: Scene[] = [
  { id: 'desk', label: 'Стол', src: withBasePath('/bg7.jpg') },
  { id: 'notebook', label: 'Тетрадь', src: withBasePath('/bg10.jpg') },
];
