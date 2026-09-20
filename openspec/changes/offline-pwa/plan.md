# План прогона: offline-pwa

База прогона: `ee2314db413e7083c1672b25c920dc2ead610050`
Гейт: `npm run lint && npm test`
Быстрые проверки: `npm run typecheck`, `npx vitest run --project=unit tests/<файл>.test.ts`
Долгие слои: `npm run test:stories`, `npm run test:visual` — группа G5 (подтвердить, что эталоны не поехали)

Хук коммита гоняет полный `typecheck` и `vitest --changed`: каждая группа оставляет типы и тесты зелёными.

## Контракты

- **K1 иконки** — `public/icon-192.png` 192×192, `public/icon-512.png` 512×512, `public/icon-maskable-512.png`
  512×512 (`purpose: 'maskable'`, рисунок в центральных 80 %). Владелец G1; потребители G2, G3.
- **K2 precache** — `workbox.globPatterns` = `**/*.{js,css,html,json,svg,png,jpg,ttf,webmanifest}`; вне списка
  только `sw.js`, `workbox-*.js`, `404.html`. Манифест читается из собранного `dist/sw.js`. Владелец G2;
  потребитель G3.
- **K3 базовый путь** — `base` из `BASE_PATH`; `scope`, `start_url`, адреса precache и `navigateFallback`
  начинаются с него. Владелец G2; потребитель G3.
- **K4 регистрация** — `registerServiceWorker({onNeedRefresh, onOfflineReady, onRegisterError})` из
  `src/app/model/serviceWorkerRegistration.ts` возвращает `updateServiceWorker(reloadPage?)`. Единственный файл с
  `virtual:pwa-register`. Владелец G4; потребители G4 (хук), G5.
- **K5 состояние** — `useServiceWorkerState(register = registerServiceWorker)` → `{isOfflineReady, hasUpdate,
  update, dismiss}`. Владелец G4; потребитель G5.

## Группы

### G1 · Иконки приложения · M · волна 1

- Задачи: 1.1, 1.2, 1.3
- Зависит от: —
- Файлы: `scripts/build-app-icons.ts`, `package.json`, `public/icon-*.png`, `tests/app-icons.test.ts`
- Требования: `offline-app` → «Приложение устанавливается»
- Design: D5
- Контракты: вводит K1
- Усиление проверок: 1.1, 1.2 — «файл создан» беззубо: добавить `tests/app-icons.test.ts`, читающий IHDR трёх PNG
  (ширина, высота, наличие альфы) и падающий при отличии от K1

### G2 · Плагин PWA, манифест, service worker · M · волна 2

- Задачи: 2.1, 2.2, 2.3, 2.4, 2.5
- Зависит от: G1 (иконки для манифеста)
- Файлы: `vite.config.ts`, `index.html`, `package.json`, `package-lock.json`
- Требования: `offline-app` → «Кэш загружается целиком при первом визите», «Приложение устанавливается»,
  «Старые версии кэша не накапливаются», «Разработка идёт без service worker»
- Design: D1, D2 (конфиг), D4 (globPatterns), D6
- Контракты: вводит K2, K3; потребляет K1
- Усиление проверок: 2.5 — проверка `BASE_PATH` прогоном руками не держится: сверку `scope`/`start_url`/адресов с
  базой берёт на себя тест G3, конфиг обязан её пройти при обоих значениях `BASE_PATH`

### G3 · Тест полноты precache и манифеста · M · волна 3

- Задачи: 3.1, 3.2
- Зависит от: G2
- Файлы: `tests/pwa-precache.test.ts`, `tests/helpers/*`
- Требования: `offline-app` → «Кэш загружается целиком при первом визите», «Оффлайн не урезает генератор»
- Design: D4
- Контракты: потребляет K1, K2, K3
- Усиление проверок: 3.1 — «читает dist, если он есть» делает тест вечно зелёным на чистом дереве: отсутствие
  `dist` обязано ронять тест (или запускать сборку), `skip` запрещён; 3.2 — порог брать из конфига сборки и
  сверять с фактическими размерами файлов `dist`, а не только с синтетикой; в тот же тест — сверка
  `dist/manifest.webmanifest` с K1 (три иконки, размеры, `maskable`) и с K3 (префикс базового пути)

### G4 · Регистрация service worker и состояние · M · волна 3

- Задачи: 4.1, 4.2, 4.3, 4.4
- Зависит от: G2 (плагин даёт `virtual:pwa-register`)
- Файлы: `tsconfig.json`, `src/app/model/**`, `src/app/main.tsx`, `tests/service-worker-state.test.ts`
- Требования: `offline-app` → «Обновление версии происходит по решению пользователя», «Кэш загружается целиком при
  первом визите» (отказ регистрации), «Разработка идёт без service worker»
- Design: D2, D3, D6
- Контракты: вводит K4, K5; потребляет K2
- Усиление проверок: 4.2, 4.4 — «в DevTools пусто» и «файл никем не импортируется» не проверяются: добавить в
  `tests/service-worker-state.test.ts` проверку по исходникам `src`, что `virtual:pwa-register` импортирует ровно
  один файл, и что вызов регистрации в `main.tsx` закрыт `import.meta.env.PROD`

### G5 · Плашка обновления и готовности · M · волна 4

- Задачи: 5.1, 5.2, 5.3, 5.4
- Зависит от: G4
- Файлы: `src/app/ui/ServiceWorkerBanner/**`, `src/app/App.tsx`, `tests/service-worker-banner.test.tsx`
- Требования: `offline-app` → «Готовность к работе оффлайн видна пользователю», «Обновление версии происходит по
  решению пользователя»
- Design: D2, D3
- Контракты: потребляет K5
- Усиление проверок: 5.3 — тест одного компонента не доказывает подключения: рендерить `App` с подменённой
  функцией регистрации и проверять появление плашки, вызов `update` по кнопке и её отсутствие без обновления

### G6 · Документация и полный гейт · S · волна 5

- Задачи: 7.1, 7.2, 6.4
- Зависит от: G1, G2, G3, G4, G5
- Файлы: `CLAUDE.md`
- Требования: `offline-app` (весь раздел — описание реализации)
- Design: D4, D5, риск «залипший service worker»
- Контракты: потребляет K1, K2, K4
- Усиление проверок: 7.2 — сверять перечисленные файлы и команды с деревом репозитория и `package.json`, а не по
  памяти

## Волны

1. G1
2. G2
3. G3, G4 — файлы не пересекаются
4. G5
5. G6
