/* eslint-disable @typescript-eslint/no-floating-promises -- Fixed upstream */
/* eslint-disable @typescript-eslint/naming-convention -- Manifest keys and Chrome APIs aren't camelCase */
import {
	describe,
	it,
	type TestContext,
} from 'node:test';
// eslint-disable-next-line n/file-extension-in-import -- Node runs this file as TypeScript
import {assertTabAccess, injectContentScript} from './index.ts';

describe('assertTabAccess', () => {
	it('should throw the browser error when access is denied', async t => {
		// Simulate browser denying access
		const executeScript = t.mock.fn(async () => {
			throw new Error('Cannot access contents of the page. Extension manifest must request permission to access this host.');
		});
		Object.assign(globalThis, {chrome: {scripting: {executeScript}}});

		await t.assert.rejects(assertTabAccess(1), /Cannot access contents of the page/v);
	});
});

type Options = {target: unknown; files?: string[]; world?: string; injectImmediately?: boolean};

describe('injectContentScript', () => {
	const mockScripting = ({mock}: TestContext) => {
		const executeScript = mock.fn(async (_options: Options) => []);
		const insertCSS = mock.fn(async (_options: Options) => undefined);
		Object.assign(globalThis, {chrome: {scripting: {executeScript, insertCSS}}});
		return {
			executeScript,
			insertCSS,
			executed: () => executeScript.mock.calls.map(call => call.arguments[0]),
			styled: () => insertCSS.mock.calls.map(call => call.arguments[0]),
		};
	};

	it('should inject in all frames of a tab by default', async (t: TestContext) => {
		const {executed, styled} = mockScripting(t);
		await injectContentScript(1, {js: ['a.js'], css: ['a.css']});
		t.assert.deepStrictEqual(executed(), [{
			target: {tabId: 1, allFrames: true},
			files: ['a.js'],
			world: undefined,
			injectImmediately: undefined,
		}]);
		t.assert.deepStrictEqual(styled(), [{target: {tabId: 1, allFrames: true}, files: ['a.css']}]);
	});

	it('should respect `all_frames: false` for tabs, but not for frames', async (t: TestContext) => {
		const {executed} = mockScripting(t);
		await injectContentScript([1, {tabId: 2, frameId: 3}], {js: ['a.js'], all_frames: false});
		t.assert.deepStrictEqual(executed().map(options => options.target), [{tabId: 1}, {tabId: 2, frameIds: [3]}]);
	});

	it('should inject immediately for `document_start` only', async (t: TestContext) => {
		const {executed} = mockScripting(t);
		await injectContentScript(1, [
			{js: ['start.js'], run_at: 'document_start'},
			{js: ['end.js'], run_at: 'document_end'},
			{js: ['idle.js'], run_at: 'document_idle'},
		]);
		t.assert.deepStrictEqual(executed().map(options => [options.files, options.injectImmediately]), [
			[['start.js'], true],
			[['end.js'], undefined],
			[['idle.js'], undefined],
		]);
	});

	it('should pass the `world`', async (t: TestContext) => {
		const {executed, styled} = mockScripting(t);
		await injectContentScript(1, {js: ['a.js'], css: ['a.css'], world: 'MAIN'});
		t.assert.deepStrictEqual(executed().map(options => options.world), ['MAIN']);
		t.assert.deepStrictEqual(styled(), [{target: {tabId: 1, allFrames: true}, files: ['a.css']}]);
	});

	it('should accept manifest entries as they are', async (t: TestContext) => {
		const {executeScript} = mockScripting(t);
		await injectContentScript(1, {
			matches: ['https://example.com/*'],
			exclude_matches: ['https://example.com/no/*'],
			include_globs: ['*'],
			exclude_globs: ['*no*'],
			match_about_blank: true,
			match_origin_as_fallback: true,
			js: ['a.js'],
		});
		t.assert.strictEqual(executeScript.mock.callCount(), 1);
	});
});
