export default {
  '*.{js,cjs,mjs,cts,mts,jsx,ts,tsx}': 'eslint --fix',
  '*.css': 'stylelint --fix --allow-empty-input',
  '*.{css,json,yml,yaml}': 'prettier --write',
};
