---
paths:
  - "/**/*.tsx"
  - "/**/*.jsx"
---

# React-архитектура

Архитектурные правила для React-кода. Coding-патterns (хуки, хендлеры, JSX) — см. `react.md`.

1. Дочерние компоненты compound-компонента — каждый в своей папке. *(см. ниже)*
2. Не переиспользуй пропсы компонента/хука в других компонентах/хуках. Заводи отдельный интерфейс. *(см. ниже)*
3. Используй `FC<Props>` с явной типизацией пропсов. *(см. ниже)*
4. Предпочитай tailwind css модулям — модули только для кастомных значений, которые нет смысла выносить в конфиг.
5. Для темезации используй `cva` (`class-variance-authority`).

---

## Подробности

### #1. Дочерние компоненты compound — каждый в своей папке

**Why:** один компонент — одна папка с собственными типами/стилями/тестами. Иначе compound разрастается до файла на 500
строк.

**Хорошо** (`CheckboxesDropdown/`):

```
CheckboxesDropdown/
├── CheckboxesDropdown.tsx
├── Title/
│   └── Title.tsx
├── List/
│   └── List.tsx
├── useCheckboxesState/
│   └── useCheckboxesState.ts
└── index.ts
```

**Плохо:**

```
CheckboxesDropdown/
├── CheckboxesDropdown.tsx   // Title, List, Item, useCheckboxesState — всё в одном файле
└── index.ts
```

```
CheckboxesDropdown/
├── CheckboxesDropdown.tsx   // Компоненты без своих папок. Стили/пропсы/типы не изолированы
├── List.tsx
├── Item.tsx
├── useCheckboxesState.tsx
└── index.ts
```

---

### #2. Не переиспользуй пропсы компонента/хука

**Why:** реюз `FooProps` в `Bar` связывает два компонента. Любая правка `FooProps` ломает `Bar`, даже если изменение не
было задумано как часть его API. У каждого компонента/хука должен быть свой публичный интерфейс — даже если поля
совпадают сейчас.

**Хорошо:**

```tsx
// Button/Button.tsx
export type ButtonProps = {
  label: string;
  onClick: () => void;
  isDisabled?: boolean;
}

// IconButton/IconButton.tsx
export type IconButtonProps = {
  icon: IconType;
  onClick: () => void;
  isDisabled?: boolean;
}
```

**Плохо** (реюз через импорт чужих пропсов):

```tsx
// IconButton/IconButton.tsx
import type {ButtonProps} from '../Button/Button.types';

export type IconButtonProps = ButtonProps & { icon: IconType };
// связали два компонента — изменение ButtonProps ударит по IconButton
```

**Плохо** (реюз опций хука):

```ts
// useFetchUser принимает те же опции, что и useFetchProfile
import type {UseFetchProfileOptions} from './useFetchProfile';

export const useFetchUser = (options: UseFetchProfileOptions) => {
  return useQuery(queries.user(options.id), fetchUser);
};
// useFetchProfile поменяли — useFetchUser молча получил новый контракт
```

---

### #3. `FC<Props>` с явной типизацией пропсов

**Why:**

- `FC<Props>` явно говорит, что объявление — компонент, и сразу типизирует `props`;
- интерфейс пропсов экспортируется и переиспользуется в storybook/тестах/совмещённых компонентах;
- без `FC` и без интерфейса параметр `props` молча становится `any`/`implicit any` — ломаем `noImplicitAny` и теряем
  подсказки.

**Хорошо:**

```tsx
// Button.tsx
export type ButtonProps = {
  label: string;
  onClick: () => void;
  isDisabled?: boolean;
}
```

```tsx
// Button.tsx
import type {FC} from 'react';

import type {ButtonProps} from './Button.types';

export const Button: FC<ButtonProps> = (props) => {
  const {label, onClick, isDisabled} = props;

  return (
    <button onClick={onClick} disabled={isDisabled}>
      {label}
    </button>
  );
};
```

**Плохо** (без `FC` и без интерфейса — пропсы `implicit any`):

```tsx
export const Button = (props) => {
  return <button onClick={props.onClick}>{props.label}</button>;
};
```

**Плохо** (`FC` с инлайн-типом — нарушает typescript.md #8):

```tsx
export const Button: FC<{ label: string; onClick: () => void }> = (props) => {
  return null;
};
```

**Плохо** (без `FC` — пропсы типизированы, но потерян маркер «это компонент» и неявная подпись `FC`):

```tsx
export const Button = (props: ButtonProps) => {
  const {label, onClick} = props;

  return <button onClick={onClick}>{label}</button>;
};
```

### #4. Tailwind

1. Пиши все новые стили с помощью служебных классов Tailwind.
2. Существующий CSS (`src/styles/style.css`, `src/styles/main.css`) правится напрямую — переводить его на
   Tailwind скопом не нужно.
3. Придерживайтесь сетки с интервалом 4 пикселя (минимум 2 пикселя).
4. Избегайте произвольных значений (например, aia-h-[82 пикселя]).
    - По возможности предпочитайте существующие токены дизайна из конфигурации.
    - Если подходящего токена не существует, не создавайте новый токен самостоятельно.
    - Сначала спросите разработчика, можно ли:
        - в конфигурацию должен быть добавлен новый маркер дизайна
        - или вместо этого значение должно быть реализовано с помощью обычных CSS/пользовательских стилей.
    - Добавляйте новый токен только в том случае, если его значение можно использовать повторно и оно является частью
      системы проектирования.
    - Не добавляй в конфигурацию строго определенные, одноразовые или относящиеся только к компонентам значения; в таких
      случаях используйте обычный CSS.
