import type { CSSProperties, FC } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { SUBSTITUTE_FONTS } from '../../../config';
import { buildDistortions } from '../../../lib/randomize/buildDistortions';
import { buildLineDistortions } from '../../../lib/randomize/buildLineDistortions';
import { useGeneratorStore } from '../../../model/useGeneratorStore';

import type { PageLineWord } from './PageLine';
import { PageLine } from './PageLine';
import type { PagePreviewProps } from './PagePreview.types';

/**
 * Пустое искажение: нужно, когда слов на странице больше, чем описаний, —
 * например, пока не досчиталась разбивка.
 */
const NO_WORD_DISTORTION = { rotate: 0, skew: 0, translateY: 0, letters: [] };
const NO_LINE_DISTORTION = { rotate: 0, translateX: 0 };

/**
 * Лист с отрисованным текстом. Всё, что видно внутри узла, попадает в
 * сохранённый PNG: интерфейс сюда не кладём.
 */
export const PagePreview: FC<PagePreviewProps> = (props) => {
  const { pageRef, page, background } = props;
  const {
    fontSize,
    lineSpacing,
    topOffset,
    leftPadding,
    evenPageLeftPadding,
    blockWidth,
    blockRotate,
    inkColor,
    fontFamily,
    customFontFamily,
    flags,
    wordFrequency,
    letterFrequency,
    seed,
    pageIndex,
  } = useGeneratorStore(
    useShallow((state) => {
      return {
        fontSize: state.fontSize,
        lineSpacing: state.lineSpacing,
        topOffset: state.topOffset,
        leftPadding: state.leftPadding,
        evenPageLeftPadding: state.evenPageLeftPadding,
        blockWidth: state.blockWidth,
        blockRotate: state.blockRotate,
        inkColor: state.inkColor,
        fontFamily: state.fontFamily,
        customFontFamily: state.customFontFamily,
        flags: state.flags,
        wordFrequency: state.wordFrequency,
        letterFrequency: state.letterFrequency,
        seed: state.seed,
        pageIndex: state.pageIndex,
      };
    })
  );
  /**
   * Чётная страница — правая половина разворота: нумерация для пользователя
   * начинается с единицы, поэтому чётной оказывается нечётная позиция в
   * массиве.
   */
  const isEvenPage = (pageIndex + 1) % 2 === 0;
  const pageLeftPadding = isEvenPage ? evenPageLeftPadding : leftPadding;
  const lineWords = page.lines.map(({ text }) => {
    return text ? text.split(' ') : [];
  });
  const wordDistortions = buildDistortions(lineWords.flat(), {
    flags,
    wordFrequency,
    letterFrequency,
    seed,
    substituteFonts: SUBSTITUTE_FONTS,
  });
  const lineDistortions = buildLineDistortions(page.lines.length, { flags, seed });

  const textStyle: CSSProperties = {
    width: `${blockWidth}px`,
    paddingTop: `${topOffset}px`,
    paddingLeft: `${pageLeftPadding}px`,
    color: inkColor,
    fontFamily: customFontFamily ?? fontFamily,
    fontSize: `${fontSize}em`,
    ...(blockRotate === 0
      ? {}
      : { transform: `rotate(${blockRotate}deg)`, transformOrigin: 'top left' }),
  };

  const linesWithWords: PageLineWord[][] = [];
  let wordOffset = 0;

  for (const words of lineWords) {
    linesWithWords.push(
      words.map((text, index) => {
        return {
          text,
          distortion: wordDistortions[wordOffset + index] ?? NO_WORD_DISTORTION,
        };
      })
    );
    wordOffset += words.length;
  }

  return (
    <div
      ref={pageRef}
      data-testid="page"
      className="relative overflow-hidden"
      style={{
        width: `${background.width}px`,
        ...(background.height === null ? {} : { height: `${background.height}px` }),
      }}
    >
      {background.src ? (
        <img
          src={background.src}
          alt=""
          className="pointer-events-none absolute inset-0 size-full select-none"
          style={isEvenPage ? { transform: 'scaleX(-1)' } : {}}
        />
      ) : null}

      <div
        className={background.src ? 'absolute top-0 left-0' : 'relative'}
        style={textStyle}
      >
        {linesWithWords.map((pageLineWords, lineIndex) => {
          return (
            <PageLine
              key={lineIndex}
              words={pageLineWords}
              distortion={lineDistortions[lineIndex] ?? NO_LINE_DISTORTION}
              spacing={lineSpacing}
            />
          );
        })}
      </div>
    </div>
  );
};
