# План прогона: generator-ui-redesign

База прогона: `2b4334be4b077aae754c38da9ab90aaf2410536b`
Гейт: `npm run lint && npm test`
Быстрые проверки: `npm run typecheck`, `npx vitest run --project=unit tests/<файл>`
Долгие слои: `npm run test:stories` — G2, G3, G6, G9; `npm run test:visual` — G10; `npm run lint:fsd` — G3, G9
Хук коммита: lint-staged + `tsc` по всему проекту + `vitest --changed` — каждая группа оставляет типы и тесты зелёными.

## Контракты

- **K1 Документ стора** — части D3: документ, просмотр (`pageIndex`, `isSpread`, `zoom: 'fit' | number`), ресурсы;
  `ink` — union `auto | tone(toneId) | custom(color)`; экшены `setInk`, `selectRealismLevel`, `startNewRun`, `setZoom`,
  `setIsSpread`. После G1 стор в волне 3 никто не правит. Владелец G1; потребители G4–G9.
- **K2 Рецепт до картинки** — цвет чернил только `recipe.inkColor`, флаги/частоты/seed почерка только
  `recipe.handwriting`; `rg "state\.(seed|inkColor|flags)" src` пусто. Владелец G1; потребители G5, G6.
- **K3 Реализм** — `config/realismLevels.ts`: ступени по порядку «Ровно»…«Небрежно», дефолт «Обычно»; правка любого
  поля `realism` ставит `level: 'custom'`, уровень хранится явно. Владелец G1; потребители G4, G7, G8.
- **K4 Форматтеры** — `pages/Generator/lib/format/`: чистые `(value: number) => string` с единицей; `ValueSlider`
  в `shared/ui` получает форматтер пропсом и `pages` не импортирует. Владелец G2; потребители G7, G8.
- **K5 Токены** — имена по таблице D2 в `@theme`; новые классы только на токенах, `violet-|zinc-|neutral-850` в новом
  коде нет; `Slider` остаётся экспортом (старая панель живёт до G9). Владелец G2; потребители G3, G5–G9.
- **K6 История** — `commit(patch, {coalesceKey})`, `undo`, `redo`, признаки доступности; API слайдера (драг без
  шага, шаг на `onValueCommit`) G4 фиксирует в `useGeneratorStore.types.ts`, UI зовёт его, а не `setState`.
  Владелец G4; потребители G5, G7, G8.
- **K7 Сессия** — ключ `autograph.session`, `version: 1`, `partialize` = документ + `isSpread`; проверка ссылок на
  листы — отдельный шаг после `restoreUserSheets` и профилей. Владелец G4; потребители G8, G9.
- **K8 Точки монтирования** — G5 `ui/Generator/Generator.tsx` держит сетку D1 со слотами центра и справа (до G9 там
  старые `PagePreview`/`SettingsPanel`); `SheetViewport` — из `ui/Generator/SheetViewport/index.ts`, `SettingsPane`
  — из `ui/Generator/SettingsPane/index.ts`, `ExpertSettings`/`SheetDialog` — из своих папок внутри `SettingsPane/`.
  Монтирует всё G9. Владелец G5; потребители G6–G9.
- **K9 Хуки листа** — `useSheetImport`/`useSheetRemeasure` до G9 лежат по старому пути в `SettingsPanel/PaperGroup/`;
  G8 правит их аддитивно (признак «нужна ручная разлиновка» для автооткрытия диалога), G7 только вызывает, G9
  переносит в `SettingsPane/`. Владелец G8; потребители G7, G9.
- **K10 Разворот** — пара страниц `2k−1`/`2k` (1-based), `pageIndex` — индекс текущей, «Сохранить страницу» берёт
  `pageIndex`. Владелец G6; потребители G5, G9.

## Группы

### G1 · Стор и рецепт до картинки · M · волна 1

- Задачи: 1.1, 1.2, 1.3, 1.4
- Зависит от: —
- Файлы: `src/pages/Generator/model/{useGeneratorStore*,buildPageRenderParams,usePageRender,useRunRender,recipeSelectors,generator.types}.ts`, `src/pages/Generator/config/**`, `src/pages/Generator/ui/Generator/**` (только совместимость), `tests/{generator-store*,store-*,page-render-params,batch-recipe,render-determinism}.test.ts*`, остальные тесты по ошибкам `tsc`
- Требования: `generator-settings` → «Перегенерация запускает новый прогон», «Реализм задаётся уровнем»
- Design: D3, D4, D5
- Контракты: вводит K1, K2, K3
- Усиление проверок: 1.2 — тест через `usePageRender`/`useRunRender`, а не только `buildPageRenderParams`, плюс
  `rg` из K2; 1.3 — после `setText` не меняется и seed почерка в параметрах страницы; 1.4 — «Ровно» через рецепт
  даёт ленту вызовов рендерера без искажений, а не только `flags` в сторе.

### G2 · Токены, форматтеры, ValueSlider · M · волна 1

- Задачи: 1.5, 3.1, 3.2
- Зависит от: —
- Файлы: `src/app/styles/app.css`, `src/shared/ui/**` (существующие), `src/pages/Generator/lib/format/**`, `tests/format-*.test.ts`, `tests/ui-primitives.test.tsx`
- Требования: `generator-settings` → «У чисел есть единицы»; `generator-workspace` → «Общее оформление всех экранов»
- Design: D2, D9 (ValueSlider, единицы)
- Контракты: вводит K4, K5
- Усиление проверок: 3.2 — тест, что `ValueSlider` показывает форматированное значение в тексте и `aria-valuetext`.

### G3 · Новые примитивы, шапка, другие экраны · M · волна 2

- Задачи: 3.3, 3.4, 6.1
- Зависит от: G2
- Файлы: `src/shared/ui/{SegmentedControl,TileRadio,Swatch,Dialog,Disclosure,IconButton,Toolbar}/**`, `src/widgets/AppHeader/**`, `steiger.config.ts`, `package.json`, `package-lock.json`, `src/pages/{CreateFont,NotFound}/**`, `tests/ui-primitives.test.tsx`, `tests/routes.test.tsx`
- Требования: `generator-workspace` → «Общее оформление всех экранов»
- Design: D1 (шапка), D9
- Контракты: потребляет K5
- Усиление проверок: 3.3 — фокус после Esc проверять `document.activeElement === trigger`, а не наличие кнопки.

### G4 · Сессия и история правок · M · волна 2

- Задачи: 2.1, 2.2, 2.3, 2.4
- Зависит от: G1
- Файлы: `src/pages/Generator/model/{useGeneratorStore*,sessionSchema,sessionStorage*,useStoredUserSheets,usePaperProfiles}.ts`, `tests/{session-*,history-*,generator-store*}.test.ts*`
- Требования: `session-state` → все четыре
- Design: D7, D8
- Контракты: потребляет K1, K3; вводит K6, K7
- Усиление проверок: 2.2 — «перезагрузка» через `vi.resetModules` и новый импорт настоящего `useGeneratorStore`;
  2.3 — через `useStoredUserSheets`, а не вызов функции проверки напрямую.

### G5 · Каркас, текст, действия, undo · M · волна 3

- Задачи: 4.1, 4.2, 4.3, 4.8
- Зависит от: G1, G3, G4
- Файлы: `src/pages/Generator/ui/Generator/{Generator.tsx,TextPane,ActionBar,useHistoryHotkeys}/**`, `tests/{action-bar,text-pane,history-hotkeys}.test.tsx`, удалить `tests/{save-bar,batch-export}.test.tsx`
- Требования: `generator-workspace` → «Экран разделён на текст, лист и оформление», «Главные действия всегда на виду»,
  «Экран рассчитан на настольные окна»; `session-state` → «Отмена и повтор правок»
- Design: D1, D8 (клавиши)
- Контракты: вводит K8; потребляет K1, K2, K6, K10
- Усиление проверок: 4.3 — «Перегенерировать» меняет `runSeed` и цвет чернил в параметрах страницы при `auto`;
  4.1 — проверку 1440×900 с раскрытым экспертным режимом делает G9, здесь — story каркаса.

### G6 · Область просмотра · M · волна 3

- Задачи: 4.4, 4.5, 4.6, 4.7
- Зависит от: G1, G3
- Файлы: `src/pages/Generator/ui/Generator/SheetViewport/**`, `tests/{sheet-viewport*,spread-view,page-nav}.test.tsx`, `tests/page-preview.test.tsx`
- Требования: `generator-workspace` → «Лист вписывается в область просмотра и масштабируется», «Режим разворота»,
  «Навигация по страницам»
- Design: D6
- Контракты: вводит K10; потребляет K1, K2, K8
- Усиление проверок: 4.4 — проверять размер основного canvas = `min(zoom, fitZoom) × DPR`, а не только `fitZoom`;
  4.6 — зеркальность чётной страницы по параметрам рендера страницы 2, не только глазом в story.

### G7 · Оформление: основной путь · M · волна 3

- Задачи: 5.1, 5.2, 5.3, 5.4
- Зависит от: G1, G3, G4
- Файлы: `src/pages/Generator/ui/Generator/SettingsPane/{SettingsPane.tsx,index.ts,PaperPicker,HandwritingPicker,InkPicker,RealismPicker}/**`, `tests/{paper-picker,handwriting-picker,ink-picker,realism-picker}.test.tsx`
- Требования: `generator-settings` → «Основной путь из нескольких решений», «Бумага выбирается по виду листа»,
  «Почерк выбирается по образцу», «Чернила выбираются из палитры реальных ручек», «Реализм задаётся уровнем»
- Design: D5, D9
- Контракты: потребляет K1, K3, K5, K6, K9
- Усиление проверок: 5.3 — «ручной цвет не меняется» проверять по `inkColor` параметров страницы, не по стору.

### G8 · Экспертный режим и диалог листа · M · волна 3

- Задачи: 5.5, 5.6
- Зависит от: G1, G2, G3, G4
- Файлы: `src/pages/Generator/ui/Generator/SettingsPane/{ExpertSettings,SheetDialog}/**`, `src/pages/Generator/ui/Generator/SettingsPanel/PaperGroup/{useSheetImport,useSheetRemeasure}/**`, `openspec/changes/generator-ui-redesign/design.md` (Open Question сцены), `tests/{expert-settings,sheet-dialog}.test.tsx`, удалить `tests/paper-group-*.test.tsx`
- Требования: `generator-settings` → «У чисел есть единицы», «Свой лист настраивается в отдельном диалоге»,
  «Вложение в сцену — экспертная настройка»
- Design: D5, D7 (ссылки), D9
- Контракты: вводит K9; потребляет K1, K3, K4, K6
- Усиление проверок: 5.5 — обойти все слайдеры и числовые поля и проверить единицу у каждого; 5.6 — аудитор сверяет
  перечень `it` удалённых `paper-group-*` с новым файлом один к одному.

### G9 · Сборка экрана и удаление старого UI · M · волна 4

- Задачи: 5.7, 7.1
- Зависит от: G5, G6, G7, G8
- Файлы: `src/pages/Generator/ui/Generator/**`, `src/app/styles/app.css` (снять `neutral-850`), `src/**/*.stories.tsx`, `tests/{settings-panel,generator-screen,routes}.test.tsx`
- Требования: `generator-workspace` → «Экран разделён на текст, лист и оформление», «Главные действия всегда на виду»;
  `generator-settings` → «Основной путь из нескольких решений»
- Design: D1, D6, D9
- Контракты: потребляет K7, K8, K9, K10
- Усиление проверок: компонентный тест на маршруте `/` находит «Вписать», свотчи чернил, «Экспертный режим», поле
  текста и полосу действий; story 1440×900 с раскрытым экспертным режимом (из 4.1); неудачный импорт открывает
  диалог на экране; `rg "violet-|zinc-|neutral-850|SettingsPanel|SaveBar|PageNav" src tests` пусто.

### G10 · Эталоны и документация · S · волна 5

- Задачи: 7.2, 7.4
- Зависит от: G9
- Файлы: `tests/visual/__screenshots__/**`, `CLAUDE.md`
- Требования: `generator-workspace` → «Общее оформление всех экранов»
- Design: D10
- Контракты: —
- Усиление проверок: 7.2 — нужен docker; эталоны удалённых stories удалены (нет файлов без story).

## Волны

1. G1, G2 — файлы не пересекаются (G2 не трогает старый UI)
2. G3, G4
3. G5, G6, G7, G8 — стор не правят; `Generator.tsx` только у G5
4. G9
5. G10
