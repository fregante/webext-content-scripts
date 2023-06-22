import chromeP from 'webext-polyfill-kinda';
import {patternToRegex} from 'webext-patterns';
import type {ContentScript, ExtensionFileOrCode, RunAt} from './types.js';

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

type MaybeArray<X> = X | X[];

const nativeFunction = /^function \w+\(\) {[\n\s]+\[native code][\n\s]+}/;

export async function executeFunction<Fn extends (...args: any[]) => unknown>(
	target: number | Target,
	function_: Fn,
	...args: unknown[]
): Promise<ReturnType<Fn>> {
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
			args,
		});

		return injection?.result as ReturnType<Fn>;
	}

	const [result] = await chromeP.tabs.executeScript(tabId, {
		code: `(${function_.toString()})(...${JSON.stringify(args)})`,
		frameId,
	}) as [ReturnType<Fn>];

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
	files: string [] | ExtensionFileOrCode[];
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
	const everyInsertion = Promise.all(files.map(async content => {
		if (typeof content === 'string') {
			content = {file: content};
		}

		if (gotScripting) {
			return chrome.scripting.insertCSS({
				target: {
					tabId,
					frameIds: arrayOrUndefined(frameId),
					allFrames,
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
	const normalizedFiles = files.map(file => typeof file === 'string' ? {file} : file);
	if (gotScripting) {
		assertNoCode(normalizedFiles);
		const injection = chrome.scripting.executeScript({
			target: {
				tabId,
				frameIds: arrayOrUndefined(frameId),
				allFrames,
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
			// eslint-disable-next-line no-await-in-loop -- On purpose, see above
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
	const injections = castArray(scripts).flatMap(script => [
		insertCSS({
			tabId,
			frameId,
			allFrames,
			files: script.css ?? [],
			matchAboutBlank: script.matchAboutBlank ?? script.match_about_blank,
			runAt: script.runAt ?? script.run_at as RunAt,
		}, options),

		executeScript({
			tabId,
			frameId,
			allFrames,
			files: script.js ?? [],
			matchAboutBlank: script.matchAboutBlank ?? script.match_about_blank,
			runAt: script.runAt ?? script.run_at as RunAt,
		}, options),
	]);

	await Promise.all(injections);
}

// Sourced from:
// https://source.chromium.org/chromium/chromium/src/+/main:extensions/common/extension_urls.cc;drc=6b42116fe3b3d93a77750bdcc07948e98a728405;l=29
// https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Content_scripts
const blockedPrefixes = [
	'chrome.google.com/webstore', // Host *and* pathname
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

export function isScriptableUrl(url: string): boolean {
	if (!url.startsWith('http')) {
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
