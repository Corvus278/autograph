---
paths:
  - "/**"
---

# Линтеры

Правила стиля и синтаксиса живут в конфигах, а не в голове:

- `/eslint.config.mjs` — JS/TS (typescript-eslint + prettier + jsdoc + simple-import-sort + unicorn);
- `/stylelint.config.mjs` — CSS (stylelint-config-standard + послабления под Tailwind 4);
- `/.prettierrc` + `/.prettierignore` — форматирование;
- `/tsconfig.json` — строгий TS (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`).

## Поток проверки

1. **Перед правкой** сомнительного места — открой конфиг и прочитай релевантную секцию. Правил много, и они меняются.
2. **После каждой правки** срабатывает PostToolUse-хук `.claude/hooks/lint.sh`:

   - `eslint` для `.ts/.js/.mjs/.cjs` по одному файлу;
   - `stylelint` + `prettier --check` для `.css`;
   - `tsc --noEmit -p tsconfig.json --incremental` для `.ts` — типы по всему проекту (кэш в
     `node_modules/.cache/claude-tsc.tsbuildinfo`, таймаут 90 сек). Ошибки в правленом файле блокируют; ошибки в других
     файлах показываются предупреждением, чтобы не застревать на чужих долгах;
   - `severity: error` в правленом файле → exit 2, правка блокируется, ошибки — в stderr;
   - `severity: warning` → exit 0, предупреждения всё равно в stderr;
   - сбой линтера → exit 1 + диагностика.

3. **Перед завершением задачи** — `npm run lint` (eslint + tsc + stylelint + prettier параллельно) и `npm test`.
   0 errors и 0 warnings в новом коде.

## Запреты

- Не отключать правила через `// eslint-disable*`, `/* stylelint-disable */`, `@ts-ignore`, `@ts-expect-error` ради
  прохождения проверки.
- Не ослаблять и не удалять правила в `eslint.config.mjs` / `stylelint.config.mjs` / `tsconfig.json`. Действующие
  послабления и причины перечислены в `CLAUDE.md` («Линтинг») — новые заводятся только с обоснованием там же.
- Не обходить типы через `any`, `as unknown as T`, `@ts-nocheck`.
- Автофиксы допустимы (`eslint --fix`, `stylelint --fix`), но **не на CSS вслепую**: stylelint однажды уже вырезал
  префиксные фолбэки и превратил `display: -ms-flexbox` в невалидное `display: flexbox`. После автофикса —
  прочитай диф.
- Если непонятно, как починить правильно, — спроси. Не прячь проблему в TODO.
