---
paths:
  - "/**"
---

# Именование

Здесь — только конвенции, которые линтер не проверяет

1. Все новые переменные — `camelCase`, кроме констант (`SCREAMING_SNAKE_CASE`, см. #8) и классов (`PascalCase`).
2. Стили именуются в camelCase.
3. Типы/интерфейсы без венгерской нотации (IData, TUser).
4. Обработчики событий — `handle` (например, `handleButtonClick`), колбэки — `on`.
5. Булевы переменные и пропсы — только с разрешёнными префиксами. Общий набор: `is`, `has`, `should`. Для React-пропсов
   дополнительно разрешены: `are`, `have`, `must`, `with`. Других префиксов не вводим. *(см. ниже)*
6. Используй короткие, но точные имена для переменных, методов, классов, компонентов, хуков.
7. Тип пропсов компонента — `{ComponentName}Props`.
8. Константы — `SCREAMING_SNAKE_CASE`.

---

## Подробности

### #5. Префиксы булевых переменных и пропсов

Закрытый список правила `react/boolean-prop-naming`. Само правило в конфиге не включено — соблюдаем руками.

#### Общий набор (любые булевы переменные / пропсы)

| Префикс  | Когда                                      |
|----------|--------------------------------------------|
| `is`     | текущее состояние: `isOpen`, `isLoading`   |
| `has`    | наличие чего-то: `hasContent`, `hasErrors` |
| `should` | необходимость действия: `shouldFocus`      |

#### Дополнительно разрешено только для React-пропсов

| Префикс | Когда                                               |
|---------|-----------------------------------------------------|
| `are`   | состояние коллекции: `areItemsSelected`             |
| `have`  | наличие у коллекции: `haveResults`                  |
| `must`  | строгое требование: `mustReload`                    |
| `with`  | флаг включения подсистемы: `withFooter`, `withIcon` |

**Хорошо** (общие переменные):

```ts
const isOpen = true;
const hasErrors = errors.length > 0;
const shouldFocus = !isLoading && hasErrors;
```

**Хорошо** (React-пропсы):

```ts
export type ModalProps = {
  isOpen: boolean;
  hasCloseIcon: boolean;
  shouldFocusFirstField: boolean;
  withFooter: boolean;
  areAllItemsSelected: boolean;
  haveErrors: boolean;
  mustConfirmClose: boolean;
}
```

**Плохо:**

```ts
const enabled = true;            // нет префикса
const visible = false;           // нет префикса
const flagOpen = true;           // мусорный префикс
const bDisabled = false;         // венгерская нотация
const canEdit = true;            // префикс вне списка
const willChange = true;         // префикс вне списка
const didMount = true;           // префикс вне списка
const wasModified = true;        // префикс вне списка
const needsUpdate = true;        // префикс вне списка
```

**Плохо** (React-пропс с обычным префиксом из дополнительного набора — линтер пропустит, но в коде `must`/`with` за
пределами пропсов не используем):

```ts
const mustReload = true;         // не пропс — общему набору не соответствует
const withIcon = true;           // не пропс — общему набору не соответствует
```
