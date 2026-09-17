# План прогона: sheet-on-surface

База прогона: `edff6513556330585c3fcfa8a30bccca479e74a6`
Гейт: `npm run lint && npm test`
Быстрые проверки: `npm run typecheck`, `npx vitest run --project=unit tests/<файл>`
Долгие слои: `npm run test:stories` — G6, G9, G10; `npm run build:paper` — G9; `npm run measure:sheet` — G9, G10;
`npm run test:visual` — G10
Хук коммита гоняет полный `tsc` и `vitest --changed`: каждая группа оставляет типы и юнит-тесты зелёными.
Пути `lib/`, `model/`, `config/`, `ui/` — от `src/pages/Generator/`; `PG/` — `ui/Generator/SettingsPanel/PaperGroup/`.

## Контракты

- **K1 Контур** — `SheetOutline { topLeft, topRight, bottomRight, bottomLeft }` px кадра; `SheetRuling.outline` обязательное,
  `null` — лист во весь кадр; `resolveSheetBounds(outline, w, h)` → отступы формы `PaperMargins`. Владелец G1; все.
- **K2 Перспектива и линия** — `RulingPerspective { originX, originY, convergenceX, convergenceY }`; `U`, `Y`, `∂Y/∂x`, `∂Y/∂U` —
  `lineCoordinateAt`, `lineHeightAt`, `lineHeightSlopeAt(projection, u)`, `lineHeightScaleAt`, первый аргумент
  `RulingProjection { skewAngle, perspective }` (разлиновка листа подходит сама), только из `lib/paper/rulingPerspective.ts`; линия `y_k(x) = Y(x, firstLinePhase + k·step) + d(x, U_k)`, `d > 0` вниз;
  при `perspective: null` `U = y − x·tgθ`. Владелец G1; потребители G2, G5, G6, G7, G9.
- **K3 Сборка и отражение** — `buildSheetRuling(source, { width, height })`, поля в px фото, фолбэк — 1,5 шага от сторон
  `resolveSheetBounds`; перспективу, контур и изгиб отражает только `mirrorSheetRuling`. Владелец G2; потребители G6, G7, G8.
- **K4 Выборка изгиба** — `sampleRulingBend(bend, { skewAngle, perspective }, x, y)`, `sampleRulingBendSlope` — ∂d/∂x при
  const `U`; строки узлов по `U`. Владелец G2; потребители G6, G7, G9.
- **K5 Синтетика** — API `tests/helpers/synthetic-sheet.ts`: прежние вызовы не меняются, эталонные `outline`/`perspective` в
  формах K1/K2, линии — своя запись формулы design без импорта `lib/paper`; после G3 не правится. Владелец G3; G4, G5, G7, G8.
- **K6 Контур и свет** — `detectSheetOutline(image) → SheetOutline | null` (ненайденная сторона лежит точно на краю кадра,
  `null` — ни одной); `extractLighting`/`extractTexture` с `{ outline }`, без контура побитово прежние. Владелец G4; G7.
- **K7 Детектор перспективы** — `detectRulingPerspective(вырезка, ровный проход, frame)` → перспектива в px входа или `null` +
  данные отчёта (шаг у крайних линий, расхождение гребёнок) и уточнённые `skewAngle`, `step`, `firstLinePhase` (выпрямлять
  копию G7 обязан уточнённым наклоном, иначе линии встают мимо); третий аргумент `PerspectiveFrame { left, top, width, height }`
  — отступы вырезки и размеры кадра, по ним меряется `1 − a·q ≥ 0,5`; перевод перспективы в кадр — G7. Владелец G5; G7.
- **K8 Измерение фото** — `measureSheetPhoto(image, { kind, outline? })` → `{ source, outline, lighting, textureMap,
  diagnostics }`; `diagnostics` несёт всё для отчётов 7.3. Владелец G7; потребители G8, G9.
- **K9 Раскладка** — `lib/calibrate`, `lib/paginate`, `measureLayout` не читают `bend` и `outline`; перспектива — только через
  `U(0, ·)` и четыре числа отпечатка. Владелец G6; все.
- **K10 Режим отрисовки** — сдвиг точек при `perspective !== null || bend !== null`, `Δ = Y(P.x, U) + d − P.y`, P — px страницы
  без `scale`; `RenderGeometry.perspective` заполняет `buildPageRenderParams`; лента ровного листа прежняя. Владелец G6; G9, G10.
- **K11 JSON** — `outline`/`perspective` необязательны, испорченные → `null`, `PAPER_PROFILES_VERSION` = 2. Владелец G8; G9.
- **K12 Эталоны** — 1.1 из `git show <база>:public/paper/profiles.json`; 1.2 и 5.3 — одной командой
  `npx vitest run --project=unit tests/synthetic-sheet-detect-timing.test.ts`; 7.4 сверяет с 1.1. Владелец G1; G7, G9.
- **K13 Хабы** — в волне 3 `lib/paper/{index,paper.types}.ts` правит только G4, G5 держит типы в
  `detectRulingPerspective.types.ts`; `public/paper/profiles.json` коммитит только G9.
- **K14 Красная зона** — с 7.4 до 8.2 `test:visual` падает; stories G9 чинит в своей группе. Вводит G9; снимает G10.

## Группы

### G1 · Модель контура и перспективы · M · волна 1

- Задачи: 1.1, 1.2, 2.1, 2.2, 2.3
- Зависит от: —
- Файлы: `lib/paper/{paper.types,resolveSheetBounds,rulingPerspective,index}.ts`, `tests/paper-{sheet-bounds,ruling-perspective}*`;
  литералы `null` — список 2.1 и вывод `typecheck`
- Требования: `paper-profile` → «Экземпляр листа владеет своей разлиновкой»
- Design: «Контур — в разлиновке экземпляра…», «Перспектива — дробно-линейная координата вдоль линий»
- Контракты: вводит K1, K2, K12
- Усиление проверок: 2.3 — `U`/`Y` в трёх точках сверить с числами, посчитанными по формуле design вне модуля; 1.1, 1.2 — до кода

### G2 · Разлиновка на контуре и перспективе · M · волна 2

- Задачи: 2.4, 2.5, 2.6
- Зависит от: G1
- Файлы: `lib/paper/{sheetRuling,mirrorSheetRuling,sampleRulingBend}.ts`, `tests/paper-{sheet-ruling,ruling-bend}*`; вызовы —
  `config/paperFamilies.ts`, `model/paperSheetJson.ts`, `PG/**`, `scripts/build-paper-profiles.ts`,
  `lib/render/renderPageToCanvas.ts`, `ui/Generator/PagePreview/*.stories.tsx`, `tests/**` по `rg`
- Требования: `paper-profile` → «Ненайденные границы берутся долями шага»; `page-render` → «Чётные страницы зеркалятся»
- Design: «Контур — в разлиновке экземпляра…», «Изгиб поверх перспективы», «Отражение»
- Контракты: вводит K3, K4; потребляет K1, K2
- Усиление проверок: 2.5 — в тот же тест изгиб с несимметричными узлами (линия `Y + d`) и верхнее поле на той же линии `U`

### G3 · Синтетика листа на поверхности · M · волна 2

- Задачи: 3.1
- Зависит от: G1
- Файлы: `tests/helpers/synthetic-sheet.ts`, `tests/synthetic-sheet.test.ts`
- Требования: `paper-profile` → «Измерения листа не выходят за его контур», «Перспектива разлиновки измеряется надёжно»
- Design: «Контур листа: четыре прямые по полосам кадра», Context (замеры фото)
- Контракты: вводит K5; потребляет K1, K2 (только типы)
- Усиление проверок: 3.1 — центр линии мерить центроидом тёмного в столбце растра, не возвратом функции хелпера

### G4 · Контур листа, свет и текстура по контуру · M · волна 3

- Задачи: 4.1, 4.2
- Зависит от: G1, G3
- Файлы: `lib/paper/{detectSheetOutline,extractLighting,extractTexture,paper.types,index}.ts`,
  `tests/paper-{detect-outline,lighting}*`
- Требования: `paper-profile` → «Измерения листа не выходят за его контур», «Освещение и текстура извлекаются из фотографии»
- Design: «Контур листа: четыре прямые по полосам кадра», «Свет и текстура только с бумаги»
- Контракты: вводит K6; потребляет K1, K5, K13
- Усиление проверок: 4.2 — эталон «до правки» снять на базе прогона и вписать в тест литералами, не прогоном нового кода

### G5 · Измерение перспективы · M · волна 3

- Задачи: 5.1
- Зависит от: G1, G3
- Файлы: `lib/paper/detectRulingPerspective{,.types}.ts`, `tests/paper-detect-perspective*`
- Требования: `paper-profile` → «Перспектива разлиновки измеряется надёжно»
- Design: «Перспектива: измерение по выпрямленной копии», пп. 1–3
- Контракты: вводит K7; потребляет K2, K5, K13
- Усиление проверок: 5.1 — порог хранения с обеих сторон: отход ⅟₁₅ шага даёт не `null`

### G6 · Перспектива в раскладке и отрисовке · M · волна 3

- Задачи: 6.1, 6.2, 6.3
- Зависит от: G2
- Файлы: `lib/paper/sheetRuling.ts` (`resolveFirstLine`), `lib/calibrate/deriveGeometry.ts`,
  `model/{measureLayout,buildPageRenderParams}.ts`, `lib/render/{render.types,renderPageToCanvas}.ts`,
  `tests/{calibrate-geometry,layout-*,render-*,page-render-params,text-on-sheet*}.test.ts`
- Требования: `page-calibration` — все четыре; `page-render` → «Страница равна кадру листа», «Чётные страницы зеркалятся»
- Design: «Раскладка в координате вдоль линий», «Отрисовка: общий вертикальный сдвиг точек»
- Контракты: вводит K9, K10; потребляет K2, K3, K4
- Усиление проверок: 6.1 — соседние строки на соседних линиях по всей высоте (номер линии по `U`);
  6.2 — геометрия из `buildPageRenderParams`, не литерал `RenderGeometry`; контроль `perspective: null` > 0,1 шага; поправка
  вниз не сбивает с перспективы; 6.3 — поля фолбэком, контроль `outline: null` выходит за контур

### G7 · Измерение фото в границах листа · M · волна 4

- Задачи: 4.3, 5.2, 5.3
- Зависит от: G2, G3, G4, G5
- Файлы: `lib/paper/measureSheetPhoto*.ts`, `lib/paper/{paper.types,index}.ts`, `tests/paper-measure-sheet-photo*`,
  `tests/synthetic-sheet-detect-timing.test.ts`
- Требования: `paper-profile` → «Измерения листа не выходят за его контур», «Перспектива разлиновки измеряется надёжно»,
  «Ненайденные границы берутся долями шага»
- Design: «Измерение в вырезке…», «Перспектива: измерение по выпрямленной копии», пп. 4–5; риск «Импорт дольше»
- Контракты: вводит K8; потребляет K3, K4, K5, K6, K7, K12
- Усиление проверок: 5.2 — изгиб сверять в точках между узлами и у краёв области, не только в узлах

### G8 · Свой лист: импорт, хранение, перемер границ · M · волна 5

- Задачи: 4.4, 7.1, 7.2
- Зависит от: G7
- Файлы: `PG/{PaperGroup.tsx,useSheetImport/**,useSheetRemeasure/**,SheetBoundsForm/**}`, `model/paperSheetJson.ts`,
  `scripts/build-paper-profiles.ts` (только перевод 4.4), `tests/{paper-group-*,paper-sheet-json,*user-sheets}.test.ts*`
- Требования: `paper-profile` → «Ручная правка границ листа перемеряет лист», «Ручная правка разлиновки сохраняется
  целиком», «Пользовательские листы сохраняются между сессиями», «Импорт фотографии листа определяет его характеристики»
- Design: «Ручная правка: границы с перемером, разлиновка как сейчас», «Хранение, JSON, профили»
- Контракты: вводит K11; потребляет K3, K8
- Усиление проверок: 7.1 — каждый признак порчи отдельным случаем; 7.2 — через `PaperGroup`, не изолированную форму

### G9 · Скрипт замера, пресеты, stories · M · волна 6

- Задачи: 7.3, 7.4, 8.1
- Зависит от: G6, G8
- Файлы: `scripts/{measure-sheet,build-paper-profiles}.ts`, `package.json`, `public/paper/profiles.json`,
  `tests/paper-profiles.test.ts`, `ui/Generator/PagePreview/{BaselineFit,RasterRuling}.stories.tsx`
- Требования: `paper-profile` → «Пресет-пак поставляется с приложением»; `page-calibration` → «Строки следуют перспективе…»
- Design: «Хранение, JSON, профили»; риски «Пресеты линейки получают перспективу…», «Stories попадания…»
- Контракты: вводит K14; потребляет K2, K4, K8, K10, K11, K12
- Усиление проверок: 7.4 — тест: листы линейки с `perspective` в сыром `profiles.json` разбираются приложением в не-`null`

### G10 · Эталоны, документация, гейт, приёмка · S · волна 7

- Задачи: 8.2, 8.3, 8.4, 8.5
- Зависит от: G9
- Файлы: `tests/visual/__screenshots__/**`, `CLAUDE.md`
- Требования: все дельты change (гейт, `openspec validate sheet-on-surface --strict`)
- Design: риск «Пресеты линейки получают перспективу…» (эталоны)
- Контракты: снимает K14
- Усиление проверок: 8.5 — фото `IMG_*` лежат в корне основного репозитория: в worktree их нет

## Волны

1. G1
2. G2, G3 — хелпер синтетики правит только G3
3. G4, G5, G6 — хабы `lib/paper` у G4 (K13), `sheetRuling.ts` и отрисовка у G6
4. G7
5. G8
6. G9
7. G10
