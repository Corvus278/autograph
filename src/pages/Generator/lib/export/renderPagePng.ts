import { getFontEmbedCSS, toPng } from 'html-to-image';

/**
 * Во сколько раз снимок крупнее экранного размера. Рукописный текст на
 * единичном масштабе выглядит замыленным.
 */
const PIXEL_RATIO = 2;

/**
 * Снимает PNG со страницы. Локальные шрифты приходится вшивать в снимок:
 * `html-to-image` рисует через SVG `foreignObject`, а он не видит шрифты
 * документа.
 */
export const renderPagePng = async (node: HTMLElement): Promise<string> => {
  const fontEmbedCSS = await getFontEmbedCSS(node);

  return toPng(node, {
    pixelRatio: PIXEL_RATIO,
    width: node.offsetWidth,
    height: node.offsetHeight,
    fontEmbedCSS,
  });
};
