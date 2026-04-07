import {chrome} from 'jest-chrome';
import {
	describe, it, expect,
} from 'vitest';
import {executeFunction} from './index.js';

// @ts-expect-error junk types
chrome.tabs.query.mockImplementation((_query: unknown, callback: (...arguments_: any) => void) => {
	callback([]);
});

describe('executeFunction', () => {
	it('should throw with native functions', async () => {
		await expect(executeFunction(1, Date)).rejects.toMatchInlineSnapshot('[TypeError: Native functions need to be wrapped first, like `executeFunction(1, () => alert(1))`]');
	});
});
