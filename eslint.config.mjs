// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt({
  rules: {
    'no-empty': 'off',
    'no-cond-assign': 'off',
    'no-trailing-spaces': 'error',
    'no-unused-vars': 'off',
    'no-template-curly-in-string': 'warn',
    'nuxt/nuxt-config-keys-order': 'off',
    '@typescript-eslint/ban-ts-comment': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': 'off',
    '@stylistic/brace-style': 'off',
    '@stylistic/max-statements-per-line': 'off',
    'vue/html-self-closing': 'off',
    'vue/multi-word-component-names': 'off'
  }
})
