# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Что это

Генератор рукописного текста: пользователь вводит текст, выбирает рукописный шрифт и фон
(тетрадный лист, клетка, чистый лист), сервис рисует страницу в браузере и сохраняет её в PNG — саму по себе или
вложенной в фотографическую сцену.

## Стек и сборка

React 19 + TypeScript (strict) + Vite 7, Tailwind 4, Radix-примитивы, zustand, react-router. SPA: одна точка входа
`index.html`.

```bash
npm install
npm run dev                # dev-сервер, http://localhost:5173 (host: true — доступен по сети)
npm run build              # tsc --noEmit && vite build -> dist/
npm run preview            # раздача dist/, http://localhost:4173
npm run typecheck          # только проверка типов
npm run lint               # eslint + tsc + stylelint + prettier + steiger параллельно
npm run lint:fix           # eslint --fix
npm test                   # vitest: юнит- и компонентные тесты (проект `unit`)
npm run test:stories       # прогон stories в Chromium через Playwright (проект `storybook`)
npm run test:visual        # скриншотные тесты в docker-образе Playwright
npm run test:visual:update # переснять эталоны скриншотов (тот же образ)
npm run storybook          # Storybook на http://localhost:6006
```

Порог браузеров — `.browserslistrc` (`baseline widely available`, версии не фиксированы). `vite.config.ts` читает его
через `browserslist-to-esbuild`.

Деплой: содержимое `dist/` заливается в корень хостинга. Приложение — SPA, поэтому хостинг должен отдавать
`index.html` на неизвестные пути, иначе прямой заход на `/create-font` вернёт 404.

## Структура

```
index.html vite.config.ts vitest.config.ts tsconfig.json steiger.config.ts package.json
eslint.config.mjs stylelint.config.mjs .prettierrc .editorconfig    # линтеры
.lintstagedrc.mjs .husky/pre-commit                                  # гейт коммита
.storybook/                                                          # main, preview
src/
  app/            main.tsx, App.tsx (маршруты), styles/app.css (Tailwind-тема и @font-face)
  pages/
    Generator/    экран генератора: ui, model, lib, config
    CreateFont/   статичная инструкция «как создать свой шрифт»
    NotFound/     экран «не найдено»
  shared/
    ui/           примитивы на Radix: Slider, Checkbox, RadioGroup, Select, Accordion, Label, Tooltip,
                  Button, FileInput, ColorInput, TextArea
    lib/styles/   cx, twMerge
    lib/random/   mulberry32, randomInt, pickRandomItems
    lib/files/    чтение файла как data URL, скачивание data URL
public/           копируется в dist/ как есть: fonts/*.ttf, фоны листа и сцен, favicon
tests/            юнит- и компонентные тесты, helpers/
```

Слои `widgets`, `features` и `entities` пустые: продукт — один экран, поднимать код слоем выше нечего. Правила
раскладки — `.claude/rules/fsd.md`, границы проверяет `npm run lint:fsd` (steiger).

## Как работает генератор

1. **Стор.** `pages/Generator/model/useGeneratorStore.ts` — единственный источник правды о параметрах: текст, шрифт,
   цвет чернил, геометрия блока, флаги искажений, фон, сцена, номер страницы, seed. DOM только отображает; компоненты
   подписываются селекторами, на несколько полей сразу — через `useShallow`.
2. **Измерение.** Ядро не трогает DOM само: `lib/measure/` описывает интерфейс `TextMeasurer` и его реализацию на
   скрытом offscreen-контейнере (ширина снимается через `Range.getClientRects()`). В тестах подставляется измеритель с
   фиксированной шириной символа. Перед измерением ждём загрузки шрифта (`lib/measure/waitForFont.ts`).
3. **Разбивка.** `lib/split/splitParagraphs.ts` — текст → абзацы → строки по ширине блока (слово не разрывается);
   `lib/paginate/paginate.ts` — строки → страницы по доступной высоте. Результат кэшируется в
   `model/measureLayout.ts` по ключу «текст + ширина + высота + шрифт + размер + интервал»: параметры, не меняющие
   переносы (поворот, цвет, сдвиги, искажения), применяются CSS-ом без повторного измерения.
4. **Искажения.** `lib/randomize/` превращает слова и строки в описания стилей (`rotate`, `skew`, `translateY`,
   `letterSpacing`, подмена шрифта буквы). Случайность — `mulberry32` на seed из стора: без seed любой ререндер менял
   бы почерк. Seed меняется при правке текста, переключении искажений и по кнопке «Перегенерировать».
5. **Отрисовка.** `ui/Generator/PagePreview/` — фон, слой текста, строки и слова отдельными элементами (иначе к ним не
   применить построчные и пословные трансформации). Чётные страницы — правая половина разворота: фон зеркалится, левый
   отступ берётся из своего параметра.
6. **Экспорт.** `lib/export/renderPagePng.ts` снимает PNG через `html-to-image` с вшитыми шрифтами;
   `lib/export/composeWithScene.ts` вкладывает снимок в сцену на `canvas`. Математика вписывания вынесена в
   `fitPageIntoScene.ts` и покрыта юнит-тестами.

В снимок попадает только узел страницы — панель настроек и навигация лежат вне него.

## Ассеты

- Шрифты — `public/fonts/*.ttf`, объявления `@font-face` — в `src/app/styles/app.css`, список для панели —
  в `pages/Generator/config/fonts.ts`. Добавляя шрифт, правь оба места.
- Фоны листа — `public/33.jpg` (клетка), `public/line.jpg` (линейка), `public/page_3.png` (чистый лист); сцены —
  `public/bg7.jpg`, `public/bg10.jpg`. Размеры встроенных фонов продублированы в
  `pages/Generator/config/backgrounds.ts`: по ним считается высота страницы до загрузки картинки.
- Пользовательский шрифт подключается через FontFace API под именем `UserFont`; фон и сцена читаются как data URL.

## Тесты

Четыре слоя:

| Слой | Команда | Что держит |
|---|---|---|
| Юнит | `npm test` | Ядро на измерителе-модели: перенос, пагинация, рандомизация, математика вписывания в сцену, стор |
| Компонентные | `npm test` | Контролы, панель настроек, предпросмотр, сохранение — jsdom + `@testing-library/react` |
| Stories в браузере | `npm run test:stories` | Настоящий layout (перенос и пагинация на живом измерителе), клавиатура, проверки `a11y` |
| Скриншотные | `npm run test:visual` | Внешний вид примитивов, панели и предпросмотра |

Тесты лежат плоско в `tests/`, хелперы — в `tests/helpers/`. Компонентные тесты просят jsdom директивой
`@vitest-environment jsdom` в шапке файла; заглушки того, чего в jsdom нет (`ResizeObserver`, `document.fonts`,
`FontFace`, `Range.getClientRects`), — в `tests/helpers/jsdom-setup.ts`.

Эталоны скриншотов снимаются только в docker-образе Playwright: рукописные шрифты растрируются в macOS и Linux
по-разному. Прогон вне образа не предусмотрен — обе команды (`test:visual`, `test:visual:update`) идут через
`visual:docker`. Seed искажений в stories фиксирован — иначе каждый прогон давал бы другой почерк. Подробности —
`tests/visual/README.md`.

## Линтинг

```
eslint.config.mjs        # flat config: typescript-eslint + prettier + jsdoc + simple-import-sort + unicorn +
                         # react-hooks и jsx-a11y на **/*.tsx
stylelint.config.mjs     # stylelint-config-standard + послабления под Tailwind 4
steiger.config.ts        # границы слоёв FSD
.lintstagedrc.mjs        # eslint --fix / stylelint --fix / prettier --write по staged-файлам
.husky/pre-commit        # lint-staged + tsc + vitest --changed параллельно
```

Осознанные послабления:

- `no-undef` выключен для TS: необъявленное имя ловит `tsc`.
- В stylelint выключены `property-no-vendor-prefix` / `value-no-vendor-prefix`, `import-notation` и разрешены
  at-правила Tailwind (`@theme`, `@apply`, `@layer`, …): Tailwind 4 объявляет тему прямо в CSS, а
  `@import 'tailwindcss'` плагин ищет по строковой форме.

`.claude/hooks/lint.sh` — PostToolUse-хук: после каждой правки гоняет по файлу eslint (+`tsc --noEmit` для `.ts`/
`.tsx`) или stylelint + `prettier --check` для `.css`. Ошибки в правленом файле блокируют правку.

## Правила для агентов

`.claude/rules/*.md`, читать перед правкой соответствующих файлов:

| Файл | О чём |
|---|---|
| `fsd.md` | слои и сегменты Feature-Sliced Design, public API, направление зависимостей |
| `react.md`, `react-architecture.md` | компоненты, хуки, хендлеры, `FC<Props>`, cva, Tailwind |
| `typescript.md` | типы, `as`, jsdoc на полях, где лежат тесты |
| `code-style.md` | стиль кода: экспорты, `switch`, `||`, `reduce`, jsdoc |
| `naming.md` | именование, префиксы булевых |
| `styles.md` | CSS: локальные стили, Tailwind-токены |
| `linting.md` | конфиги линтеров, поток проверки, что нельзя отключать |
| `comments.md` | комментарии: «почему», а не «что» |
| `testing.md` | vitest, слои тестов, окружение jsdom |
