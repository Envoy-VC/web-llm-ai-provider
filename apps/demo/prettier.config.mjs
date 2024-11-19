import commonPrettierOptions from '@envoy1084/style-guide/prettier/next';

/** @type {import('prettier').Config & import('prettier-plugin-tailwindcss').PluginOptions} */
const config = {
  ...commonPrettierOptions,
  plugins: [...commonPrettierOptions.plugins, 'prettier-plugin-tailwindcss'],
};

export default config;
