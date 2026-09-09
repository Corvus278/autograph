import type { Preview } from '@storybook/react-vite';

import '../src/app/styles/app.css';

const preview: Preview = {
  parameters: {
    /**
     * Нарушения доступности роняют прогон stories: требование «все контролы
     * доступны с клавиатуры и подписаны» проверяется автоматически, а не
     * на ревью.
     */
    a11y: { test: 'error' },
    viewport: {
      options: {
        desktop: {
          name: 'Десктоп 1280',
          styles: { width: '1280px', height: '900px' },
          type: 'desktop',
        },
      },
    },
  },
  initialGlobals: {
    viewport: { value: 'desktop', isRotated: false },
  },
};

export default preview;
