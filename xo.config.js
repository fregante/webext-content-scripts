import globals from 'globals';

/**
@type {import('xo').FlatXoConfig}
*/
const xoConfig = [
	{
		files: ['index.test.ts'],
		rules: {
			// Tests cover the deprecated `getTabsByUrl`
			'@typescript-eslint/no-deprecated': 'off',
			// Tests need to cover `http:` URLs
			'unicorn/prefer-https': 'off',
			// `node:test` registers tests, no need to await them
			'@typescript-eslint/no-floating-promises': 'off',
		},
	},
	{
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.webextensions,
			},
		},
		rules: {
			'unicorn/prefer-ternary': 'off',
			'@typescript-eslint/consistent-type-definitions': 'off',
			'regexp/no-useless-character-class': 'off',
			'unicorn/prefer-string-replace-all': 'off',
		},
	},
];

export default xoConfig;
