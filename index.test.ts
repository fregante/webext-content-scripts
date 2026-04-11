/* eslint-disable @typescript-eslint/consistent-type-assertions */
import {chrome} from 'jest-chrome';
import {
	describe, it, assert, expect,
} from 'vitest';
import {executeFunction, getTabsByUrl, isScriptableUrl} from './index.js';

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

// @ts-expect-error junk types
chrome.tabs.query.mockImplementation((query, callback: (...arguments_: any) => void) => {
	// eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- Junk types
	callback(queryMap.get(query.url[0]) ?? []);
});

describe('getTabsByUrl', () => {
	it('should handle the matches array', async () => {
		assert.deepEqual(
			await getTabsByUrl([]),
			[],
			'No patterns means no tabs',
		);
		assert.deepEqual(
			await getTabsByUrl(['https://example.com/*']),
			[1],
			'It should pass the query to chrome.tabs',
		);
		assert.deepEqual(
			await getTabsByUrl(['*://*/*']),
			[1, 2],
			'It should pass the query to chrome.tabs',
		);
	});

	it('should handle the `excludeMatches` array', async () => {
		const excludeMatches = ['http://*/*'];
		assert.deepEqual(
			await getTabsByUrl([], excludeMatches),
			[],
			'No patterns means no tabs',
		);
		assert.deepEqual(
			await getTabsByUrl(['https://example.com/*'], excludeMatches),
			[1],
			'It should pass the query to chrome.tabs',
		);
		assert.deepEqual(
			await getTabsByUrl(['*://*/*'], excludeMatches),
			[1],
			'It should exclude tabs with URLs matching `excludeMatches`',
		);
		assert.deepEqual(
			await getTabsByUrl(['http://no-way.example.com/*'], excludeMatches),
			[],
			'It should exclude tabs with URLs matching `excludeMatches`, even if it’s the only match',
		);
	});
});

describe('executeFunction', () => {
	it('should throw with native functions', async () => {
		await expect(executeFunction(1, Date)).rejects.toMatchInlineSnapshot('[TypeError: Native functions need to be wrapped first, like `executeFunction(1, () => alert(1))`]');
	});
});

describe('isScriptableUrl', () => {
	it('should return true for regular http/https URLs', () => {
		assert.equal(isScriptableUrl('https://example.com/'), true);
		assert.equal(isScriptableUrl('http://example.com/'), true);
	});

	it('should return false for non-http URLs', () => {
		assert.equal(isScriptableUrl(undefined), false);
		assert.equal(isScriptableUrl('chrome://settings'), false);
		assert.equal(isScriptableUrl('about:blank'), false);
		assert.equal(isScriptableUrl('file:///etc/hosts'), false);
	});

	it('should return false for Chrome Web Store URLs', () => {
		assert.equal(isScriptableUrl('https://chrome.google.com/webstore'), false);
		assert.equal(isScriptableUrl('https://chrome.google.com/webstore/detail/foo'), false);
		assert.equal(isScriptableUrl('https://chromewebstore.google.com/'), false);
		assert.equal(isScriptableUrl('https://chromewebstore.google.com/detail/foo'), false);
	});

	it('should return false for Chrome Safe Browsing URLs', () => {
		assert.equal(isScriptableUrl('https://sb-ssl.google.com/safebrowsing/clientreport/download'), false);
		assert.equal(isScriptableUrl('https://safebrowsing.googleapis.com/v4/threatMatches:find'), false);
		assert.equal(isScriptableUrl('https://safebrowsing.google.com/safebrowsing/ping'), false);
	});

	it('should return true for safe-browsing-adjacent URLs that are not restricted', () => {
		assert.equal(isScriptableUrl('https://safebrowsing.google.com/'), true);
		assert.equal(isScriptableUrl('https://safebrowsing.google.com/other-path'), true);
	});

	it('should return false for Firefox restricted URLs', () => {
		assert.equal(isScriptableUrl('https://addons.mozilla.org/en-US/firefox/'), false);
		assert.equal(isScriptableUrl('https://accounts.firefox.com/'), false);
	});
});
