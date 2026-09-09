/**
 * @type {import('stylelint').Config}
 */
export default {
  extends: ['stylelint-config-standard'],
  ignoreFiles: ['dist/**', 'node_modules/**', 'storybook-static/**'],
  rules: {
    // `@import 'tailwindcss'` — не обычный CSS-импорт, а точка входа плагина
    // Tailwind: он ищет её по строковой форме, `url()` не понимает.
    'import-notation': null,
    // Tailwind 4 не имеет конфига в JS: тема и слои объявляются at-правилами
    // прямо в CSS, и stylelint про них не знает.
    'at-rule-no-unknown': [
      true,
      {
        ignoreAtRules: [
          'theme',
          'apply',
          'layer',
          'source',
          'utility',
          'variant',
          'custom-variant',
          'reference',
          'config',
          'plugin',
        ],
      },
    ],
    'selector-class-pattern': null,
    // Префиксы во flex-раскладке — не мусор, а фолбэк для старых браузеров, на
    // которые генератор рассчитан. Автофикс stylelint-config-standard режет их
    // вслепую: `display: -ms-flexbox` превращается в невалидное
    // `display: flexbox`, а `-webkit-box-align` просто исчезает.
    'property-no-vendor-prefix': null,
    'value-no-vendor-prefix': null,
    // Те же префиксные фолбэки: `-ms-flexbox` и `-webkit-box-*` нестандартны
    // по определению, ругаться на них смысла нет.
    'declaration-property-value-no-unknown': [
      true,
      { ignoreProperties: { display: ['/^-/'] } },
    ],
    'property-no-deprecated': [true, { ignoreProperties: ['/^-webkit-box/', '/^-ms-/'] }],
    // `word-break: break-word` — устаревший алиас, но менять его на
    // `overflow-wrap` значит трогать перенос слов в отрисовываемой картинке.
    'declaration-property-value-keyword-no-deprecated': [
      true,
      { ignoreKeywords: ['break-word'] },
    ],
  },
};
