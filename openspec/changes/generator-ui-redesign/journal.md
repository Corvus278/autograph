# Журнал прогона

Решения без заказчика, отступления от спеки, итоги аудитов и долг прогона change `generator-ui-redesign`.

## 2026-09-19

### Старт прогона

База: 2b4334be4b077aae754c38da9ab90aaf2410536b. Масштаб средний, режим дерево, исполнители по одному.
Живые образцы не нужны: задачи не содержат приёмки на данных пользователя.
Вне групп: 7.3 (ручная приёмка в браузере) — к пользователю в финале.
5.4 в G7, числа ступеней реализма агент подбирает приближённо; приёмку на глаз — вопросом пользователю в финале.
Решения планировщика: старая панель компилируется на новом сторе до G9; проверка 4.1 «1440×900 с экспертным режимом» — в G9; useSheetImport/useSheetRemeasure переезжают в SettingsPane/ в G9 (спека молчит).

### G1 · Стор и рецепт до картинки

Стор = документ & просмотр & ресурсы; чернила/почерк только из рецепта (selectPageRecipe — плоский снимок); regenerate удалён, runSeed меняет только startNewRun.
Отступление от D5: частоты ступеней 4/1, 2/2, 1/3 (wordFrequency — «каждое N-е слово»); аудитор подтвердил смысл спеки. Таблицу D5 в design.md обновить в 5.4 (G7).
Отступление: поля scene* оставлены плоскими в документе (форму K1 не задаёт).
Аудит: ok с первого круга.
Долг: шкала частот у wordFrequency и letterFrequency направлена противоположно (1 = очень часто / очень редко) — учесть в форматтерах K4 (G2) и G8; realism-levels.test не проверяет частоты; нет прямой проверки inkColor/pages после selectRealismLevel; flags ступени по ссылке на незамороженный конфиг; мёртвые public/33.jpg, line.jpg, page_3.png — убрать в G9/G10; эталоны скриншотов разойдутся до G10.

### G2 · Токены, форматтеры, ValueSlider

Форматтеры lib/format: доли шага, градусы, px, проценты из доли, частоты словами — два форматтера частот (у wordFrequency шкала обратная), долг G1 закрыт.
Токены D2 в @theme (oklch); примитивы на токенах; ValueSlider с formatValue и onValueCommit; Slider — обёртка до G9.
Отступление: токенов --text-*--line-height нет (stylelint custom-property-pattern), интервалы из темы Tailwind.
Проверка 3.1 «край листа в story» перенесена в G6.
Аудит: ok с первого круга.
Долг: нет утилиты для подписей секций (капс xs с разрядкой) — собирать одинаково в G5/G7–G9; fg-subtle на hover:bg-border = 4,08:1 < AA — не класть; Slider отдаёт aria-valuetext голым числом — удалить в G9; .prettierrc без tailwindStylesheet (классы токенов сортируются в начало) — добавить в G3; twMerge не сливает spacing-токены w-text-panel/h-header — для G5.

### G3 · Новые примитивы, шапка, другие экраны

Примитивы SegmentedControl, TileRadio, Swatch/SwatchGroup, Dialog (управляемый, trigger необязателен), Disclosure, IconButton, Toolbar на Radix; widgets/AppHeader со слотом actions; шапка на CreateFont и NotFound.
Решение координатора: .prettierrc tailwindStylesheet + пересортировка классов.
Отступления: добавлен @radix-ui/react-toolbar вне proposal — вопрос пользователю в финале; алиас @widgets в tsconfig/vite/vitest вне файлов группы (вынужденно); <header> в CreateFont → <div> (второй banner).
Аудит: ok с первого круга.
Долг: в routes.test добавить «/» и «генератор → Свой шрифт» после монтирования шапки (G5/G9); Swatch — знак всегда text-accent-fg, на светлой заливке проверить контраст в G7; SegmentedControl внутри Toolbar — вложенный роуминг, решить в G6; фраза «widgets пустой» в CLAUDE.md — в G10.

### G4 · Сессия и история правок

Сессия: persist под ключом autograph.session, проверка по полям в getItem хранилища (parseSession), чужая версия/мусор → дефолты целиком; дросселирование 500 мс + сброс на pagehide; свой шрифт не сохраняется.
История (K6): commit/preview/undo/redo, склейка по ключу поля в окне 800 мс, глубина 100; resolveSheetRefs в restoreUserSheets/setPresetFamilies/undo/redo.
Отступления от D7: проверка полей в getItem, а не в merge; проверка ссылок в экшенах стора, а не в хуках (поведение то же).
Аудит: ok с первого круга; question — диапазон поправки геометрии в сессии не проверяется (диапазоны лежат в GeometryGroup.tsx, не в config) → пользователю в финале.
Долг: undo во время драга (есть previewBase) теряет previewBase — учесть в G5/G7; слушатель pagehide копится после vi.resetModules в тестах.

### Вопросы пользователю

1. @radix-ui/react-toolbar добавлен в G3 вне proposal (стрелки по toolbar по WAI-ARIA) — оставить?
2. G4 question: диапазон поправки геометрии в сохранённой сессии не проверяется (только конечность); вынести диапазоны в config и проверять или принять?
3. 7.3 — ручная приёмка в браузере; 5.4 — числа ступеней реализма на глаз.

### G5 · Каркас, текст, действия, undo

Каркас GeneratorLayout со слотами (header/text/viewport/settings/actions), TextPane со счётчиком, ActionBar (SaveBar/BatchBar удалены), HistoryControls в шапке, useHistoryHotkeys по event.code; во время драга (previewBase) хоткеи ничего не делают — долг G4 закрыт.
Отступления: GeneratorLayout/ и HistoryControls/ вне списка файлов; колонка настроек min-w токена и растёт до G9; routes.test поправлен в G5 по указанию координатора.
Аудит: ok с первого круга; покрытие пачки из batch-export/save-bar перенесено в action-bar.test.
Долг (G9): routes.test поле «Текст» через getAllByRole — вернуть getByRole; подсказка «Введите текст…» без aria-describedby у кнопок; нет явной проверки, что composeScene не вызван при выключенной сцене.

### G6 · Область просмотра

SheetViewport: вписывание, лестница масштаба √2 (10–400 %), зум колесом и панорама пробелом, детальный растр min(zoom×DPR,1) с отменой на правку; PageSwitcher «‹ N / M ›» и стрелки (кроме полей ввода/роумингов); разворот 2k−1/2k с пустым блоком у непарной, SpreadToggle рядом с Toolbar (долг G3 закрыт). Проверка 3.1 закрыта story Fit (контраст ≥ 3:1).
Отступления: аддитивный requestedIndex в model/usePageRender.ts; своя подделка ResizeObserver в тесте; навигация видна при одной странице.
Эстафета: пачка 2 — новый исполнитель (65 вызовов у первого). Аудит: ok с первого круга.
Долг: правая страница разворота без заглушки слева, пока источник левой null; «разворот не меняет экспорт» — сквозную проверку через кнопку «Сохранить страницу» добрать в G9.

### G7 · Оформление: основной путь

Пикеры SettingsPane/: PaperPicker (плитки семей, «Своё фото», свои листы с ⚙ → onSheetSettingsOpen), HandwritingPicker (Radix Select с образцами шрифта, «Свой шрифт» первым), InkPicker («Авто» + тона, контраст Swatch ≥ 9:1 — долг G3 закрыт), RealismPicker (ступени, «Свой» при custom).
Отступления: таблица D5 в design.md обновлена под 4/1, 2/2, 1/3; тест монотонности частот в realism-levels.test (файл G1) — долг G1 закрыт; импорт из плитки с isBlank:false — флажок в G8; SettingsPane.tsx не собран — G9.
Числа ступеней на глаз не подбирались — вопрос пользователю.
Аудит: ok с первого круга.
Долг (G9): проверка selectPageSheetId после смены семьи.

### G8 · Экспертный режим и диалог листа

ExpertSettings: Disclosure → Accordion из 5 групп (свёрнуты), закрепление экземпляра, свой цвет, 13 слайдеров с единицами. SheetDialog { sheetId, onSheetIdChange }: черновик разлиновки + флажок «Лист без разлиновки», «Сохранить»/«Отмена»; «Перемерить» и «Удалить» (с подтверждением) — сразу. Автооткрытие через requestManualRuling (модульная подписка рядом с useSheetImport). Open Question о единицах сцены закрыт в design.md.
Отступления: «Запас снизу» подписан со знаком (formatStepFraction); кнопки переименованы по задаче. Тесты paper-group-* перенесены в sheet-dialog.test 1:1 (26 it).
Аудит: ok с первого круга; question — «Перемерить» пишет лист сразу (вместе с флажком без разлиновки), спека «применять только по подтверждению» → пользователю.
Долг (G9): при монтаже SheetDialog — стабильный onSheetIdChange; ровно один SheetDialog (подписчики в модуле); перенос useSheetImport вместе с manualRulingRequest*.

### Вопросы пользователю (дополнение)

4. G8 question: «Перемерить» в SheetDialog применяет перемер (и флажок «без разлиновки» из черновика) сразу, без «Сохранить»; спека: «изменения применяются только по подтверждению» — считать «Перемерить» подтверждением?

### G9 · Сборка экрана и удаление старого UI

Экран собран: SettingsPane (пикеры + ExpertSettings + один SheetDialog со стабильным onSheetIdChange), SheetViewport, ActionBar; хуки листа перенесены в SettingsPane/. Удалены SettingsPanel, PagePreview, PageNav, Slider, settings-panel.test, public/{33.jpg,line.jpg,page_3.png}. Пробные stories переведены на SheetViewport; story Screen/ExpertMode 1440×900 — проверка 4.1 закрыта.
Закрыт долг G9: getByRole в routes, aria-describedby у недоступных кнопок, composeScene при выключенной сцене, разворот→экспорт сквозным тестом, selectPageSheetId после смены семьи, w-settings-panel.
Отступления: правки вне файлов G9 — shared/ui/Button (describedBy), ui-primitives/cx тесты, пути моков; a11y landmark-unique — секции пикеров div role=group, группа «Лист» → «Бумага».
Аудит: ok с первого круга; покрытие settings-panel.test перенесено.
Долг: story Screen проверяет группы toBeVisible, а не expectInWindow; нет теста «сворачивает группу, не трогая параметры». Для G10: CLAUDE.md:297 старый путь useSheetRemeasure; эталоны PagePreview/SettingsPanel/Slider без stories.

### G10 · Эталоны и документация

Эталоны пересняты в docker (88), удалены эталоны PagePreview/SettingsPanel/Slider; test:visual ×3 зелёный. CLAUDE.md обновлён под новый экран, стор, историю, сессию, widgets/AppHeader, алиасы.
Решение координатора (блокер нестабильности): SheetDialog/Open без клика «Отмена», проверка «Отмена» — в CancelClosesDialog без эталона; GeneratorLayout/Narrow-Window исключена из скриншотов через новый SKIPPED_STORIES (страница шире окна, снимок выходит за iframe).
Аудит: ok с первого круга.
Долг: в CLAUDE.md нет GeneratorLayout в списке ui/Generator; «примитивы на Radix» неточно; эталоны SheetViewport/Fit и Zoom-And-Fit побайтно равны. Нативное «Choose File / No file chosen» в FileInput (HandwritingPicker, SceneSection) — на итоговый аудит.
