/* eslint-disable @typescript-eslint/consistent-type-assertions -- Test mocks need assertions */
import {chrome} from 'jest-chrome';
import {
	describe,
	it,
	expect,
	vi,
} from 'vitest';
import {executeFunction, assertTabAccess} from './index.js';

const tab1 = {
	id: 1,
	url: 'https://example.com/index.html',
} as chrome.tabs.Tab;
const tab2 = {
	id: 2,
	url: 'http://no-way.example.com/other/index.html',
} as chrome.tabs.Tab;

const queryMap = new Map([
	['https://example.com/*', [tab1]],
	['http://no-way.example.com/*', [tab2]],
	['*://*/*', [tab1, tab2]],
]);

chrome.tabs.query.mockImplementation((query, callback: (...arguments_: any) => void) => {
	callback(queryMap.get((query.url as string[])[0]!) ?? []);
});

describe('executeFunction', () => {
	it('should throw with native functions', async () => {
		await expect(executeFunction(1, Date)).rejects.toMatchInlineSnapshot('[TypeError: Native functions need to be wrapped first, like `executeFunction(1, () => alert(1))`]');
	});
});

describe('assertTabAccess', () => {
	it('should throw with native functions', async () => {
		await expect(assertTabAccess(1)).rejects.toMatchInlineSnapshot('[TypeError: Native functions need to be wrapped first, like `executeFunction(1, () => alert(1))`]');
	});

	it('should throw the browser error when access is denied', async () => {
		// Simulate browser denying access
		const executeScript = vi.fn().mockRejectedValueOnce(new Error('Cannot access contents of the page. Extension manifest must request permission to access this host.'));
		Object.assign(globalThis.chrome, {scripting: {executeScript}});

		await expect(assertTabAccess(1)).rejects.toThrow('Cannot access contents of the page');
	});
});
