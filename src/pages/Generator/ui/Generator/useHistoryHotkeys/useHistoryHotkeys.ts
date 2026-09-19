import { useEffect } from 'react';

import { useGeneratorStore } from '../../../model/useGeneratorStore';

type HistoryCommand = 'undo' | 'redo';

/**
 * Какую команду истории просит нажатие. Клавиша берётся по `code`, а не по
 * `key`: в русской раскладке `key` у той же клавиши — «я», и отмена не
 * срабатывала бы.
 *
 * @param event — нажатие
 * @returns команда истории; `null` — нажатие не про историю
 */
const resolveCommand = (event: KeyboardEvent): HistoryCommand | null => {
  const { code, ctrlKey, metaKey, shiftKey, altKey } = event;

  if (altKey || !(ctrlKey || metaKey)) {
    return null;
  }

  switch (code) {
    case 'KeyZ': {
      return shiftKey ? 'redo' : 'undo';
    }

    case 'KeyY': {
      return ctrlKey && !shiftKey ? 'redo' : null;
    }

    default: {
      return null;
    }
  }
};

/**
 * Клавиши отмены и повтора на весь документ: Ctrl/⌘+Z, Ctrl/⌘+Shift+Z и
 * Ctrl+Y.
 *
 * Перехватываются и в поле текста: поле контролируемое и получает значение
 * из истории, а посимвольная отмена браузера после программной установки
 * значения ведёт себя непредсказуемо.
 *
 * Пока идёт перетаскивание слайдера, клавиши ничего не делают: отмена
 * посреди перетаскивания унесла бы в повтор промежуточное значение и
 * потеряла бы значение до перетаскивания, к которому отменяется шаг
 * отпускания.
 */
export const useHistoryHotkeys = (): void => {
  useEffect(() => {
    const handleDocumentKeyDown = (event: KeyboardEvent) => {
      const command = resolveCommand(event);

      if (!command) {
        return;
      }

      event.preventDefault();

      const { history, undo, redo } = useGeneratorStore.getState();

      if (history.previewBase) {
        return;
      }

      switch (command) {
        case 'undo': {
          undo();

          return;
        }

        case 'redo': {
          redo();

          return;
        }

        default: {
          throw new Error(`Неизвестная команда истории: ${String(command)}`);
        }
      }
    };

    document.addEventListener('keydown', handleDocumentKeyDown);

    return () => {
      document.removeEventListener('keydown', handleDocumentKeyDown);
    };
  }, []);
};
