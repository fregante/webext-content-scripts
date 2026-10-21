import globals from 'globals';

/**
@type {import('xo').FlatXoConfig}
*/
const xoConfig = [
	{
		files: ['index.test.ts'],
		rules: {
			// Tests need to cover `http:` URLs
			'unicorn/prefer-https': 'off',
		},
	},
	{
		files: ['package.json'],
		rules: {
			// `jest-chrome` types need `@types/jest`
			'package-json/no-orphan-types': 'off',
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
