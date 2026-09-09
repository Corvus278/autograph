import type { CSSProperties, FC } from 'react';

import type { PageWordProps } from './PageWord.types';

/**
 * Слово с искажениями. Отдельным элементом — иначе к нему не применить ни
 * поворот, ни скос: инлайновый текст трансформации не принимает.
 */
export const PageWord: FC<PageWordProps> = (props) => {
  const { text, distortion } = props;
  const { rotate, skew, translateY, letters } = distortion;
  const hasTransform = rotate !== 0 || skew !== 0 || translateY !== 0;
  const style: CSSProperties = hasTransform
    ? {
        transform: `rotate(${rotate}deg) skew(${skew}deg) translateY(${translateY}px)`,
      }
    : {};

  if (letters.length === 0) {
    return (
      <span className="inline-block" style={style}>
        {text}
      </span>
    );
  }

  const letterStyles = new Map(
    letters.map((letter) => {
      return [letter.index, letter];
    })
  );

  return (
    <span className="inline-block" style={style}>
      {[...text].map((character, index) => {
        const letter = letterStyles.get(index);

        if (!letter) {
          return <span key={index}>{character}</span>;
        }

        return (
          <span
            key={index}
            style={{
              letterSpacing:
                letter.letterSpacing === null ? undefined : `${letter.letterSpacing}px`,
              fontFamily: letter.fontFamily ?? undefined,
            }}
          >
            {character}
          </span>
        );
      })}
    </span>
  );
};
