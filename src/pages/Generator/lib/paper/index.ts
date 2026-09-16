export type { RulingDetectionOptions } from './detectRuling';
export { detectRuling } from './detectRuling';
export { measureBendDeviation } from './detectRulingBend';
export { detectSheetOutline } from './detectSheetOutline';
export type { SkewDetectionOptions } from './detectSkewAngle';
export { detectSkewAngle, MAX_SKEW_ANGLE, SKEW_ANGLE_STEP } from './detectSkewAngle';
export { ANALYSIS_IMAGE_SIZE, downsampleSheetImage } from './downsampleSheetImage';
export { encodeTextureMap, toTexturePixels } from './encodeTextureMap';
export {
  extractLighting,
  LIGHTING_USABLE_CONTRAST,
  resolveLightingGrid,
} from './extractLighting';
export { extractTexture } from './extractTexture';
export { mirrorSheetRuling } from './mirrorSheetRuling';
export type {
  ExtractLightingOptions,
  ExtractTextureOptions,
  LightingField,
  LightingGrid,
  MarginLineSide,
  PaperFamily,
  PaperMargins,
  PaperSheet,
  PaperTexture,
  RulingBend,
  RulingDetection,
  RulingKind,
  RulingPerspective,
  RulingProjection,
  SheetFrame,
  SheetImageData,
  SheetOutline,
  SheetPoint,
  SheetRuling,
  SheetRulingSource,
  TextureMap,
} from './paper.types';
export { resolveSheetBounds } from './resolveSheetBounds';
export {
  lineCoordinateAt,
  lineHeightAt,
  lineHeightScaleAt,
  lineHeightSlopeAt,
} from './rulingPerspective';
export { sampleRulingBend, sampleRulingBendSlope } from './sampleRulingBend';
export { isInsideSheetOutline } from './sheetOutlineMask';
export { buildSheetRuling, MARGIN_FALLBACK_STEPS, resolveFirstLine } from './sheetRuling';
export { synthesizeLighting } from './synthesizeLighting';
