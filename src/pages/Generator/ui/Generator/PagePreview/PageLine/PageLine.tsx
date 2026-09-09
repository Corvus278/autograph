import type { CSSProperties, FC } from 'react';
import { Fragment } from 'react';

import type { PageLineProps } from './PageLine.types';
import { PageWord } from './PageWord';

/**
 * Строка страницы. Каждая строка — свой элемент: только так к ней применяются
 * «съезд линий» и горизонтальный сдвиг.
 */
export const PageLine: FC<PageLineProps> = (props) => {
  const { words, distortion, spacing } = props;
  const { rotate, translateX } = distortion;
  const hasTransform = rotate !== 0 || translateX !== 0;
  const style: CSSProperties = {
    marginBottom: `${spacing}px`,
    ...(hasTransform
      ? { transform: `rotate(${rotate}deg) translateX(${translateX}px)` }
      : {}),
  };

  if (words.length === 0) {
    return (
      <div data-testid="line" style={style}>
        &nbsp;
      </div>
    );
  }

  return (
    <div data-testid="line" style={style}>
      {words.map(({ text, distortion: wordDistortion }, index) => {
        return (
          <Fragment key={index}>
            {index > 0 ? ' ' : null}

            <PageWord text={text} distortion={wordDistortion} />
          </Fragment>
        );
      })}
    </div>
  );
};
