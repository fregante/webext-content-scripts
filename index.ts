import chromeP from 'webext-polyfill-kinda';
import {patternToRegex} from 'webext-patterns';
import type {ContentScript, ExtensionFileOrCode, RunAt} from './types.js';

export type * from './types.js';

const gotScripting = Boolean(globalThis.chrome?.scripting);

interface AllFramesTarget {
	tabId: number;
	frameId: number | undefined;
	allFrames: boolean;
}

interface Target {
	tabId: number;
	frameId: number;
}

interface InjectionOptions {
	ignoreTargetErrors?: boolean;
}

function castTarget(target: number | Target): Target {
	return typeof target === 'object' ? target : {
		tabId: target,
		frameId: 0,
	};
}

function castAllFramesTarget(target: number | Target): AllFramesTarget {
	if (typeof target === 'object') {
		return {...target, allFrames: false};
	}

	return {
		tabId: target,
		frameId: undefined,
		allFrames: true,
	};
}

function castArray<A = unknown>(possibleArray: A | A[]): A[] {
	if (Array.isArray(possibleArray)) {
		return possibleArray;
	}

	return [possibleArray];
}

function normalizeFiles(files: InjectionDetails['files'], seen: string[] = []): ExtensionFileOrCode[] {
	return files
		.map(file => typeof file === 'string' ? {file} : file)
		.filter(content => {
			if ('code' in content) {
				return true;
			}

			const file = typeof content === 'string' ? content : content.file;
			if (seen.includes(file)) {
				console.debug(`Duplicated file not injected: ${file}`);
				return false;
			}

			seen.push(file);
			return true;
		});
}

type MaybeArray<X> = X | X[];

const nativeFunction = /^function \w+\(\) {[\n\s]+\[native code][\n\s]+}/;

export async function executeFunction<FunctionToSerialize extends (...arguments_: any[]) => unknown>(
	target: number | Target,
	function_: FunctionToSerialize,
	...arguments_: unknown[]
): Promise<ReturnType<FunctionToSerialize>> {
	if (nativeFunction.test(String(function_))) {
		throw new TypeError('Native functions need to be wrapped first, like `executeFunction(1, () => alert(1))`');
	}

	const {frameId, tabId} = castTarget(target);

	if (gotScripting) {
		const [injection] = await chrome.scripting.executeScript({
			target: {
				tabId,
				frameIds: [frameId],
			},
			func: function_,
			args: arguments_,
		});

		return injection?.result as ReturnType<FunctionToSerialize>;
	}

	const [result] = await chromeP.tabs.executeScript(tabId, {
		code: `(${function_.toString()})(...${JSON.stringify(arguments_)})`,
		matchAboutBlank: true, // Needed for `srcdoc` frames; doesn't hurt normal pages
		frameId,
	}) as [ReturnType<FunctionToSerialize>];

	return result;
}

function arrayOrUndefined<X>(value?: X): [X] | undefined {
	return value === undefined ? undefined : [value];
}

interface InjectionDetails {
	tabId: number;
	frameId?: number;
	matchAboutBlank?: boolean;
	allFrames?: boolean;
	runAt?: RunAt;
	files: string[] | ExtensionFileOrCode[];
}

// eslint-disable-next-line @typescript-eslint/naming-convention -- It follows the native naming
export async function insertCSS(
	{
		tabId,
		frameId,
		files,
		allFrames,
		matchAboutBlank,
		runAt,
	}: InjectionDetails,

	{ignoreTargetErrors}: InjectionOptions = {},
): Promise<void> {
	const normalizedFiles = normalizeFiles(files);
	const everyInsertion = Promise.all(normalizedFiles.map(async content => {
		if (gotScripting) {
			// One file at a time, according to the types
			return chrome.scripting.insertCSS({
				target: {
					tabId,
					frameIds: arrayOrUndefined(frameId),
					allFrames: frameId === undefined ? allFrames : undefined,
				},
				files: 'file' in content ? [content.file] : undefined,
				css: 'code' in content ? content.code : undefined,
			});
		}

		return chromeP.tabs.insertCSS(tabId, {
			...content,
			matchAboutBlank,
			allFrames,
			frameId,
			runAt: runAt ?? 'document_start', // CSS should prefer `document_start` when unspecified
		});
	}));

	if (ignoreTargetErrors) {
		await catchTargetInjectionErrors(everyInsertion);
	} else {
		await everyInsertion;
	}
}

function assertNoCode(files: Array<{
	code: string;
} | {
	file: string;
}>): asserts files is Array<{file: string}> {
	if (files.some(content => 'code' in content)) {
		throw new Error('chrome.scripting does not support injecting strings of `code`');
	}
}

export async function executeScript(
	{
		tabId,
		frameId,
		files,
		allFrames,
		matchAboutBlank,
		runAt,
	}: InjectionDetails,

	{ignoreTargetErrors}: InjectionOptions = {},
): Promise<void> {
	const normalizedFiles = normalizeFiles(files);
	if (gotScripting) {
		assertNoCode(normalizedFiles);
		const injection = chrome.scripting.executeScript({
			target: {
				tabId,
				frameIds: arrayOrUndefined(frameId),
				allFrames: frameId === undefined ? allFrames : undefined,
			},
			files: normalizedFiles.map(({file}) => file),
		});

		if (ignoreTargetErrors) {
			await catchTargetInjectionErrors(injection);
		} else {
			await injection;
		}

		// Don't return `injection`; the "return value" of a file is generally not useful
		return;
	}

	// Don't use .map(), `code` injections can't be "parallel"
	const executions: Array<Promise<unknown>> = [];
	for (const content of normalizedFiles) {
		// Files are executed in order, but `code` isn’t, so it must await the last script before injecting more
		if ('code' in content) {
			// eslint-disable-next-line no-await-in-loop, n/no-unsupported-features/es-syntax -- On purpose, see above
			await executions.at(-1);
		}

		executions.push(chromeP.tabs.executeScript(tabId, {
			...content,
			matchAboutBlank,
			allFrames,
			frameId,
			runAt,
		}));
	}

	if (ignoreTargetErrors) {
		await catchTargetInjectionErrors(Promise.all(executions));
	} else {
		await Promise.all(executions);
	}
}

export async function getTabsByUrl(matches: string[], excludeMatches?: string[]): Promise<number[]> {
	if (matches.length === 0) {
		return [];
	}

	const exclude = excludeMatches ? patternToRegex(...excludeMatches) : undefined;

	const tabs = await chromeP.tabs.query({url: matches});
	return tabs
		.filter(tab => tab.id && tab.url && (exclude ? !exclude.test(tab.url) : true))
		.map(tab => tab.id!);
}

export async function injectContentScript(
	where: MaybeArray<number | Target>,
	scripts: MaybeArray<ContentScript>,
	options: InjectionOptions = {},
): Promise<void> {
	const targets = castArray(where);

	await Promise.all(
		targets.map(
			async target => injectContentScriptInSpecificTarget(castAllFramesTarget(target), scripts, options),
		),
	);
}

async function injectContentScriptInSpecificTarget(
	{frameId, tabId, allFrames}: AllFramesTarget,
	scripts: MaybeArray<ContentScript>,
	options: InjectionOptions = {},
): Promise<void> {
	const seen: string[] = [];
	const injections = castArray(scripts).flatMap(script => {
		const css = normalizeFiles(script.css ?? [], seen);
		const js = normalizeFiles(script.js ?? [], seen);
		return [
			css.length > 0 && insertCSS({
				tabId,
				frameId,
				allFrames,
				files: css,
				matchAboutBlank: script.matchAboutBlank ?? script.match_about_blank,
				runAt: script.runAt ?? script.run_at as RunAt,
			}, options),

			js.length > 0 && executeScript({
				tabId,
				frameId,
				allFrames,
				files: js,
				matchAboutBlank: script.matchAboutBlank ?? script.match_about_blank,
				runAt: script.runAt ?? script.run_at as RunAt,
			}, options),
		];
	});

	await Promise.all(injections);
}

// Sourced from:
// https://source.chromium.org/chromium/chromium/src/+/main:extensions/common/extension_urls.cc;drc=6b42116fe3b3d93a77750bdcc07948e98a728405;l=29
// https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Content_scripts
const blockedPrefixes = [
	'chrome.google.com/webstore', // Host *and* pathname
	'chromewebstore.google.com',
	'accounts-static.cdn.mozilla.net',
	'accounts.firefox.com',
	'addons.cdn.mozilla.net',
	'addons.mozilla.org',
	'api.accounts.firefox.com',
	'content.cdn.mozilla.net',
	'discovery.addons.mozilla.org',
	'input.mozilla.org',
	'install.mozilla.org',
	'oauth.accounts.firefox.com',
	'profile.accounts.firefox.com',
	'support.mozilla.org',
	'sync.services.mozilla.com',
	'testpilot.firefox.com',
];

export function isScriptableUrl(url: string | undefined): boolean {
	if (!url?.startsWith('http')) {
		return false;
	}

	const cleanUrl = url.replace(/^https?:\/\//, '');
	return blockedPrefixes.every(blocked => !cleanUrl.startsWith(blocked));
}

const targetErrors = /^No frame with id \d+ in tab \d+.$|^No tab with id: \d+.$|^The tab was closed.$|^The frame was removed.$/;

async function catchTargetInjectionErrors(promise: Promise<unknown>): Promise<void> {
	try {
		await promise;
	} catch (error) {
		// @ts-expect-error Optional chaining is good enough
		// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
		if (!targetErrors.test(error?.message)) {
			throw error;
		}
	}
}

export async function canAccessTab(
	target: number | Target,
): Promise<boolean> {
	try {
		await executeFunction(castTarget(target), () => true);
		return true;
	} catch {
		return false;
	}
}
