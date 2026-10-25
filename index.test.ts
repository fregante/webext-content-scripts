/* eslint-disable @typescript-eslint/consistent-type-assertions -- Test mocks need assertions */
/* eslint-disable @typescript-eslint/naming-convention -- Manifest keys and Chrome APIs aren't camelCase */
import {chrome} from 'jest-chrome';
import {
	describe,
	it,
	expect,
	vi,
} from 'vitest';
import {assertTabAccess, injectContentScript} from './index.js';

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

describe('assertTabAccess', () => {
	it('should throw the browser error when access is denied', async () => {
		// Simulate browser denying access
		const executeScript = vi.fn().mockRejectedValueOnce(new Error('Cannot access contents of the page. Extension manifest must request permission to access this host.'));
		Object.assign(globalThis.chrome, {scripting: {executeScript}});

		await expect(assertTabAccess(1)).rejects.toThrow('Cannot access contents of the page');
	});
});

describe('injectContentScript', () => {
	const mockScripting = () => {
		const executeScript = vi.fn().mockResolvedValue([]);
		const insertCSS = vi.fn().mockResolvedValue(undefined);
		Object.assign(globalThis.chrome, {scripting: {executeScript, insertCSS}});
		return {executeScript, insertCSS};
	};

	it('should inject in all frames of a tab by default', async () => {
		const {executeScript, insertCSS} = mockScripting();
		await injectContentScript(1, {js: ['a.js'], css: ['a.css']});
		expect(executeScript).toHaveBeenCalledWith({
			target: {tabId: 1, allFrames: true},
			files: ['a.js'],
			world: undefined,
			injectImmediately: undefined,
		});
		expect(insertCSS).toHaveBeenCalledWith({target: {tabId: 1, allFrames: true}, files: ['a.css']});
	});

	it('should respect `all_frames: false` for tabs, but not for frames', async () => {
		const {executeScript} = mockScripting();
		await injectContentScript([1, {tabId: 2, frameId: 3}], {js: ['a.js'], all_frames: false});
		expect(executeScript).toHaveBeenCalledWith(expect.objectContaining({target: {tabId: 1}}));
		expect(executeScript).toHaveBeenCalledWith(expect.objectContaining({target: {tabId: 2, frameIds: [3]}}));
	});

	it('should inject immediately for `document_start` only', async () => {
		const {executeScript} = mockScripting();
		await injectContentScript(1, [
			{js: ['start.js'], run_at: 'document_start'},
			{js: ['end.js'], run_at: 'document_end'},
			{js: ['idle.js'], run_at: 'document_idle'},
		]);
		expect(executeScript).toHaveBeenCalledWith(expect.objectContaining({files: ['start.js'], injectImmediately: true}));
		expect(executeScript).toHaveBeenCalledWith(expect.objectContaining({files: ['end.js'], injectImmediately: undefined}));
		expect(executeScript).toHaveBeenCalledWith(expect.objectContaining({files: ['idle.js'], injectImmediately: undefined}));
	});

	it('should pass the `world`', async () => {
		const {executeScript, insertCSS} = mockScripting();
		await injectContentScript(1, {js: ['a.js'], css: ['a.css'], world: 'MAIN'});
		expect(executeScript).toHaveBeenCalledWith(expect.objectContaining({world: 'MAIN'}));
		expect(insertCSS).toHaveBeenCalledWith({target: {tabId: 1, allFrames: true}, files: ['a.css']});
	});

	it('should accept manifest entries as they are', async () => {
		const {executeScript} = mockScripting();
		await injectContentScript(1, {
			matches: ['https://example.com/*'],
			exclude_matches: ['https://example.com/no/*'],
			include_globs: ['*'],
			exclude_globs: ['*no*'],
			match_about_blank: true,
			match_origin_as_fallback: true,
			js: ['a.js'],
		});
		expect(executeScript).toHaveBeenCalledOnce();
	});
});
