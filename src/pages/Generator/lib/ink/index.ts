export type {
  InkLayerParams,
  InkModulation,
  InkModulationOptions,
  InkRgb,
} from './ink.types';
export type { InkLayerSurface } from './inkShader';
export {
  buildInkFragmentShader,
  INK_VERTEX_SHADER,
  modulateInkLayer,
  resolveInkLighting,
} from './inkShader';
export {
  INK_MODULATION_DEFAULTS,
  inkGain,
  modulateInkSample,
  NEUTRAL_TEXTURE_VALUE,
  resolveInkModulation,
} from './modulateInkSample';
export { sampleLightingField } from './sampleLightingField';
