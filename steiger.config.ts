import fsd from '@feature-sliced/steiger-plugin';
import { defineConfig } from 'steiger';

export default defineConfig([
  ...fsd.configs.recommended,
  {
    files: ['./src/**'],
    rules: {
      // Слои `widgets`, `features` и `entities` намеренно пустые: продукт —
      // один экран, поднимать код слоем выше нечего (правило page-first).
      'fsd/no-layer-public-api': 'off',
      // Пока экран один, часть слайсов действительно используется в одном
      // месте — это не мёртвый код, а обычный page-first.
      'fsd/insignificant-slice': 'off',
    },
  },
]);
