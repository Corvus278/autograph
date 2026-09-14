# План прогона: sheet-native-ruling

База прогона: `4bbf8a1136d9483ae93db517c8b58de79f1e9dcd`
Гейт: `npm run lint && npm test`
Быстрые проверки: `npm run typecheck`, `npx vitest run --project=unit <фильтр файла>` — после каждой группы оба зелёные (pre-commit гоняет `typecheck` и `vitest --changed`)
Долгие слои: `npm run build:paper` — G3; `npm run test:stories`, `npm run test:visual:update && npm run test:visual` — G7

## Контракты

- **K1 Разлиновка листа** — `PaperSheet.ruling: SheetRuling = { step, firstLinePhase, skewAngle, margins{top,right,bottom,left}, marginLineX: number|null, marginLineSide: 'left'|'right'|null }` в пикселях фотографии, `PaperFamily.kind`; новый код читает только их. Первая линия `firstLinePhase + ceil((margins.top − firstLinePhase)/step)·step` — одна функция в `lib/paper`, `deriveGeometry` её зовёт. Владелец G1; потребители G2–G7.
- **K2 Фолбэк границ** — одна функция сборки разлиновки в `lib/paper` из результата `detectRuling` и из записи прежней формы (`measuredStep`, `firstLinePhase`, `skewAngle`): нулевое поле = сторона не найдена, `MARGIN_FALLBACK_STEPS = 1.5`, `margins.top` вверх до линии, `marginLineX: null`; своих фолбэков в скрипте, хранилище, импорте нет. Владелец G1; потребители G3, G5.
- **K3 Разлиновка страницы** — `isMirroredPage(i) ? mirrorSheetRuling(sheet.ruling, sheet.width) : sheet.ruling`, один селектор в `model/geometrySelectors.ts`; раскладка и отрисовка берут её оттуда и по чётности не ветвятся. Владелец G2 (`mirrorSheetRuling` — G1); потребители G4, G6, G7.
- **K4 Примитивы разбивки** — `TextMeasurer` отдаёт ширину в долях кегля (замер при 200 px), в пиксели переводит вызывающий через `fontSizePx` страницы; `measureLineHeight` только в `FontMetricsProbe`; `splitParagraphs` берёт позицию старта и отдаёт позицию остановки индексом исходной строки, правило поглощения пробела/`\n` на разрыве одно; перенос режет по `blockWidth × (1 − WRAP_WIDTH_SLACK)`, `WRAP_WIDTH_SLACK = 0.01` в `lib/paginate/paginate.ts` (Linux Chromium шире замера до 0,9 %), края блока не меняются. Владелец и потребитель G4.
- **K5 Последовательность листов** — инкрементальный построитель: элемент `i` === `selectPageSheetId(state, i)`, закреплённый лист — один на все страницы. Владелец G4; потребитель G6.
- **K6 Единицы поправки** — `GeometryCorrection` и `bottomMargin` в долях `ruling.step` листа страницы; в пиксели только в `deriveGeometry` и во вместимости. Владелец G2; потребители G4, G6, G7.
- **K7 Раскладка → отрисовка** — страница раскладки несёт id листа; вместимость `countPageLines` = `floor((sheet.height − topOffset − margins.bottom − bottomMargin·step − fontAscent·fontSizePx)/lineStep) + 1` — последняя строка ставится, пока её базовая линия не ниже нижнего поля с запасом, хвосты букв могут зайти в поле; `lineStep = fontSizePx·lineHeight + lineSpacing`; рендер берёт тот же лист и геометрию по K3. Ключ кэша: текст, шрифт, метрики, поправка, запас, seed, `familyId`, отпечаток листов семьи (id и `ruling`), закреплённый лист. Владелец G4; потребители G5, G6, G7.
- **K8 Кадр страницы** — страница и снимок = `sheet.width × sheet.height` листа страницы 1:1, и при скрытом фоне; фон в `(0,0,width,height)`; масштаб — поле страницы, `renderScale` в `PageOpticsRecipe` нет. Владелец G6; потребитель G7.
- **K9 Артефакт и хранилище** — `profiles.json` с поднятой версией, экземпляр несёт `ruling` (K1); один разборщик `model/paperSheetJson.ts` для артефакта и `localStorage`, прежняя форма конвертируется через K2. Владелец G3; потребитель G5.
- **K10 Переходный слой** — всё помечено jsdoc-тегом `@deprecated sheet-native-ruling` и новым кодом не читается: `PaperSheet.measuredStep|normalizeScale|skewAngle`, `PaperFamily.width|height|ruling` (G1; производители заполняют их из `ruling` и прежнего канона); `lib/paper/{normalizeSheet,fitSheetToPage}.ts`; прежняя сигнатура `deriveGeometry` и прежний выход `usePageGeometry` для непереведённых потребителей (G2). Снимает G7: `rg "sheet-native-ruling|normalizeScale|fitSheetToPage|measuredStep" src scripts tests` пусто. Владельцы G1, G2.

## Группы

### G1 · Разлиновка экземпляра · M · волна 1

- Задачи: 1.1, 1.2, 1.3, 4.6
- Зависит от: —
- Файлы: `src/pages/Generator/lib/paper/**` (без удаления файлов), места построения `PaperSheet`: `model/paperSheetJson.ts`, `config/paperFamilies.ts`, `scripts/build-paper-profiles.ts`, `ui/Generator/PagePreview/BaselineFit.stories.tsx`, `tests/helpers/paper-family.ts`, `tests/{store-user-sheets,stored-user-sheets,page-render-params,paper-profiles,paper-fit-sheet,paper-normalize}.test.*`; новые `tests/paper-sheet-ruling*.test.ts`; удаление `tests/paginate-sheet-independent.test.ts`
- Требования: `paper-profile` → «Экземпляр листа владеет своей разлиновкой», «Ненайденные границы берутся долями шага»; `page-render` → «Чётные страницы зеркалятся»
- Design: «Разлиновка — часть экземпляра», «Первая базовая строка выводится из линии», «Зеркалирование — операция над разлиновкой», «Ненайденные границы»
- Контракты: вводит K1, K2, K10 (поля); из 1.1 удаление старых полей уходит в G7
- Готово: `npm run typecheck && npx vitest run --project=unit paper- store-user-sheets stored-user-sheets page-render-params recipe-`
- Усиление проверок: 1.2 — эталон линии — отражение точек `(x, y₀+tanθ·x)` → `(W−x, y)`, не через `mirrorSheetRuling` и K1; угол −1.17° при W=1600 (`tanθ·W` > 0.1 шага); 1.3 — случай «одна сторона найдена, остальные нули»

### G2 · Калибровка страницы · M · волна 2

- Задачи: 3.1, 3.2, 3.3
- Зависит от: G1
- Файлы: `src/pages/Generator/lib/calibrate/**`, `model/{usePageGeometry,geometrySelectors,useGeneratorStore,generator.types,pageRender.types,usePageLayout,buildPageRenderParams}.ts`, `config/{defaults,index}.ts`, `ui/Generator/SettingsPanel/GeometryGroup/**`, `ui/Generator/PagePreview/RasterRuling.stories.tsx`, `tests/{calibrate-geometry,store-geometry-correction,generator-store,settings-panel,page-preview,page-render-params}.test.*`
- Требования: `page-calibration` → «Геометрия текста выводится из разлиновки», «Ручная поправка поверх вычисленной геометрии»; `paper-profile` → сценарии «Найденные границы доезжают до отрисовки», «Линии поля на листе нет»
- Design: «Геометрия считается на каждую страницу», «Поправка и запас снизу — в долях шага»
- Контракты: вводит K3, K6, K10 (прежние геометрия и выход `usePageGeometry`; доли переводятся в пиксели по шагу канона); потребляет K1
- Готово: `npm run typecheck && npx vitest run --project=unit calibrate-geometry store-geometry-correction generator-store settings-panel page-preview page-render`
- Усиление проверок: 3.1 — «поле не кратно фазе»: `topOffset + fontAscent·fontSizePx` ≡ фаза по модулю шага и ≥ `margins.top`; зазор до линии поля ≥ `step/5`; 3.2 — вторая страница зеркальная на наклонном листе (K3), у листов с разным шагом разный кегль

### G3 · Профили, конфиг и хранилище листов · M · волна 3

- Задачи: 2.1, 2.2, 2.3, 2.4
- Зависит от: G1, G2
- Файлы: `scripts/build-paper-profiles.ts`, `public/paper/profiles.json`, `src/pages/Generator/config/{paperFamilies,config.types,index}.ts`, `model/{paperSheetJson,userSheetsStorage,userSheetsStorage.types,paperProfiles,paperSelectors}.ts`, `tests/{paper-profiles,paper-preset-families,store-user-sheets,stored-user-sheets}.test.*`
- Требования: `paper-profile` → «Пресет-пак поставляется с приложением», «Пользовательские листы сохраняются между сессиями»
- Design: «Профиль, артефакт и хранилище», «Ненайденные границы»
- Контракты: вводит K9; потребляет K1, K2, K10 (разборщик заполняет устаревшие поля из `ruling`; из 2.3 удаление размеров и канона семьи уходит в G7)
- Готово: `npm run build:paper && npm run typecheck && npx vitest run --project=unit paper-profiles paper-preset-families store-user-sheets stored-user-sheets`
- Усиление проверок: 2.2 — тест артефакта: `ruling.step` у клетки в 52–56, у линейки в 70–75, у каждого пресета `marginLineSide === 'right'`, ключей `normalizeScale`/`measuredStep` в JSON нет; отказ сборки — кадр без разлиновки, ошибка называет файл; 2.3 — геометрия через новый `deriveGeometry`: `blockWidth > 0`, блок внутри кадра, вместимость ≥ 1; 2.4 — запись прежней формы — литерал JSON, не выход нового сериализатора

### G4 · Разбивка · L · волна 3

- Задачи: 4.1, 4.2, 4.3, 4.4, 4.5
- Зависит от: G1, G2
- Файлы: `src/pages/Generator/lib/{measure,split,paginate}/**`, `lib/recipe/{pickSheetSequence,index}.ts`, `model/{recipeSelectors,measureLayout,usePageLayout,useCustomFont}.ts`, `ui/Generator/Generator.tsx`, `ui/Generator/PagePreview/PagePreview.stories.tsx`, `tests/helpers/monospace-measurer.ts`, `tests/{measure,font-metrics,custom-font-metrics,split-paragraphs,recipe-sheets,store-run-recipe,paginate,page-preview,batch-recipe,page-render}.test.*`
- Требования: `page-calibration` → «Текст перетекает со страницы на страницу без потерь», «Страница заполняется до нижнего поля своего листа»
- Design: «Разбивка становится последовательной», «Ширины меряются долями кегля», «Кэш раскладки»
- Контракты: вводит K4, K5, K7; потребляет K1, K3, K6. Файлы G6 не править: если тест отрисовки краснеет из-за прежнего пространства рендера — стоп и вопрос координатору
- Готово: `npm run typecheck && npx vitest run --project=unit measure font-metrics split-paragraphs recipe-sheets store-run-recipe paginate page-preview batch-recipe page-render`
- Усиление проверок: 4.1 — в jsdom линейность круговая: проверять одно DOM-измерение строки при двух кеглях, линейность — на живом измерителе в story G7; 4.3 — шпион на `buildRunRecipe`: при n=50 вызовов O(1); сравнение с `selectPageSheetId` на семье ≥3 листов и с закреплённым листом; 4.4 — ожидаемое число строк считать в тесте числами кадра, не функцией вместимости; `floor` у листов различается; базовая линия последней строки ближе шага строк к нижнему полю; 4.5 — правка `ruling` без смены id раскладывает заново

### G5 · Импорт и правка листа в панели · M · волна 4

- Задачи: 2.5, 2.6
- Зависит от: G1, G2, G3, G4
- Файлы: `src/pages/Generator/ui/Generator/SettingsPanel/PaperGroup/**`, `tests/settings-panel.test.tsx`, новые `tests/paper-group-*.test.tsx`
- Требования: `paper-profile` → «Импорт фотографии листа определяет его характеристики», «Ручная правка разлиновки сохраняется целиком»
- Design: «Ручная правка разлиновки»
- Контракты: потребляет K2, K7, K9; `buildNormalizedSheet` больше не зовёт
- Готово: `npm run typecheck && npx vitest run --project=unit settings-panel paper-group stored-user-sheets`
- Усиление проверок: 2.5 — импорт синтетического листа с полями и линией поля (`tests/helpers/synthetic-sheet.ts`) через настоящий `detectRuling`, проверять `margins` и `marginLineX`; 2.6 — после правки полей меняются `leftPadding`/`blockWidth` страницы и раскладка пересчитана; после перечтения хранилища поля те же

### G6 · Страница в кадре листа: отрисовка и выгрузка · L · волна 4

- Задачи: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
- Зависит от: G1, G2, G4
- Файлы: `src/pages/Generator/model/{buildPageRenderParams,buildPageTask,renderPageRequest,renderPage.worker,createPageRenderClient,renderPageImage,drawPage,pageTask.types,pageRenderWorker.types,pageRender.types,usePageRender,useRunRender,useExportPage*,useBatchExport*,useGeneratorStore,generator.types}.ts`, `lib/{render,recipe,batch}/**`, `ui/Generator/PagePreview/PagePreview.tsx`, `ui/Generator/SaveBar/**`, `tests/{page-render*,render-*,ink-layer-render,batch-*,save-bar,recipe-build,recipe-ink,page-preview,generator-store}.test.*`
- Требования: `page-render` → «Страница равна кадру листа», «Чётные страницы зеркалятся», «Растеризация в формат фотографии»; `batch-export` → «Страница сохраняется в размере своего кадра»
- Design: «Нормировка и укладка листа удаляются целиком», «Растеризация в разрешении кадра»
- Контракты: вводит K8; потребляет K3, K5–K7; перестаёт читать K10 (файлы `fitSheetToPage`/`normalizeSheet` не удаляет)
- Готово: `npm run typecheck && npx vitest run --project=unit page-render render- ink-layer-render batch- save-bar recipe- page-preview generator-store`
- Усиление проверок: 5.1 — геометрия `buildPageRenderParams` равна геометрии той же страницы в раскладке (K7); базовая линия на отражённой линии наклонного листа по эталону из 1.2; 5.3/5.5 — размер брать с записанной канвы в пути воркера и из записей архива, не из чисел плана; 5.4 — рекордер: единственный `drawImage` фона `(0,0,W,H)`, заливки подложки нет

### G7 · Снятие переходного слоя, stories, документация и гейт · L · волна 5

- Задачи: 1.4, 6.1, 6.2, 6.3, 6.4
- Зависит от: G1–G6
- Файлы: всё с меткой K10: `src/pages/Generator/lib/paper/**` (удаление `normalizeSheet`, `fitSheetToPage`), `lib/calibrate/**`, `model/{usePageGeometry,paperSheetJson,userSheetsStorage*}.ts`, `config/paperFamilies.ts`, `scripts/build-paper-profiles.ts`, `tests/**` с устаревшими полями (удаление `tests/{paper-normalize,paper-fit-sheet}.test.ts`); `ui/Generator/PagePreview/*.stories.tsx`, `.storybook/**`, `tests/visual/**`, `CLAUDE.md`
- Требования: `page-calibration` → сценарий «Строки ложатся на линии»; `page-render` → сценарий «Наклонный лист на зеркальной странице»; остатки 1.1 и 2.3 — удаление старых полей листа и семьи
- Design: «Нормировка и укладка листа удаляются целиком», «Разлиновка — часть экземпляра»
- Контракты: снимает K10; потребляет K3, K4, K7, K8
- Готово: `npm run lint && npm test && npm run test:stories && npm run test:visual`
- Усиление проверок: 1.4 — `rg` из K10 пусто; 6.1 — базовые линии сверять с линиями, найденными на растре отражённой фотографии, а не с числами раскладки; story на наклонном `grid-1`; линейность K4 на живом измерителе (две кегли, длинная строка); 6.3 — `rg -i "канон|нормир" CLAUDE.md` пусто

## Волны

1. G1
2. G2
3. G3, G4 — файлы не пересекаются
4. G5, G6 — файлы не пересекаются
5. G7
