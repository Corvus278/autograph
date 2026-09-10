export { classifyContours, contourBounds, splitContours } from './classifyContours';
export {
  DEFAULT_DEFORM_AMPLITUDE,
  DEFAULT_DEFORM_CELL,
  DEFAULT_SEAM_RAMP,
  deformGlyphPath,
} from './deformGlyphPath';
export type {
  ContourClassification,
  DeformGlyphOptions,
  GlyphBounds,
  GlyphCloseCommand,
  GlyphCubicCommand,
  GlyphLineCommand,
  GlyphMoveCommand,
  GlyphOutline,
  GlyphPathCommand,
  GlyphPoint,
  GlyphQuadCommand,
  GlyphSource,
} from './glyph.types';
export type { GlyphPointMapper } from './glyphCommands';
export { listCommandPoints, listOnCurvePoints, mapCommandPoints } from './glyphCommands';
export {
  clearFontGlyphsCache,
  createGlyphSource,
  loadFontGlyphs,
} from './loadFontGlyphs';
