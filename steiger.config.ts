import fsd from '@feature-sliced/steiger-plugin';
import { defineConfig } from 'steiger';

export default defineConfig([
  ...fsd.configs.recommended,
  {
    files: ['./src/**'],
    rules: {
      // Слои `features` и `entities` намеренно пустые, в `widgets` — одна
      // шапка трёх экранов: остальное живёт в одной странице, поднимать его
      // слоем выше нечего (правило page-first). Публичный API слоя поэтому
      // не нужен.
      'fsd/no-layer-public-api': 'off',
      // Пока экран один, часть слайсов действительно используется в одном
      // месте — это не мёртвый код, а обычный page-first.
      'fsd/insignificant-slice': 'off',
    },
  },
]);
