import { Label } from '@shared/ui/Label';
import type { ChangeEvent, FC } from 'react';
import { useId } from 'react';

import { useGeneratorStore } from '../../../model/useGeneratorStore';

import { formatCharacterCount, formatPageCount } from './formatTextStats';
import type { TextPaneProps } from './TextPane.types';

/**
 * Колонка текста: поле на всю высоту колонки и под ним счётчики.
 *
 * Поле своё, а не `TextArea` из `shared/ui`: тому задают высоту строками, а
 * здесь поле тянется за колонкой и прокручивается само, не двигая лист.
 */
export const TextPane: FC<TextPaneProps> = (props) => {
  const { pageCount } = props;
  const fieldId = useId();
  const text = useGeneratorStore((state) => {
    return state.text;
  });
  const setText = useGeneratorStore((state) => {
    return state.setText;
  });

  const handleFieldChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setText(event.target.value);
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <Label
        htmlFor={fieldId}
        className="text-xs font-semibold tracking-wider text-fg-muted uppercase"
      >
        Текст
      </Label>

      <textarea
        id={fieldId}
        value={text}
        onChange={handleFieldChange}
        className="min-h-0 flex-1 resize-none rounded-md border border-border-strong bg-surface-raised px-3 py-2 text-sm text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      />

      <p className="flex justify-between gap-2 text-xs text-fg-muted tabular-nums">
        <span>{formatCharacterCount(text.length)}</span>

        <span>{formatPageCount(pageCount)}</span>
      </p>
    </div>
  );
};
