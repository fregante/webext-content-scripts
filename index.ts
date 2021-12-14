import chromeP from 'webext-polyfill-kinda';
import type {Manifest, ExtensionTypes} from 'webextension-polyfill';

const gotScripting = typeof chrome === 'object' && 'scripting' in chrome;

function castArray<A = unknown>(possibleArray: A | A[]): A[] {
	if (Array.isArray(possibleArray)) {
		return possibleArray;
	}

	return [possibleArray];
}

interface Target {
	tabId: number;
	frameId: number;
}

export async function executeFunction<Fn extends (...args: any[]) => unknown>(
	target: number | Target,
	function_: Fn,
	...args: unknown[]
): Promise<ReturnType<Fn>> {
	const {frameId, tabId} = typeof target === 'object' ? target : {
		tabId: target,
		frameId: 0,
	};

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
	return typeof value === 'undefined' ? undefined : [value];
}

interface InjectionDetails {
	tabId: number;
	frameId?: number;
	matchAboutBlank?: boolean;
	allFrames?: boolean;
	runAt?: ExtensionTypes.RunAt;
	files: string [] | Array<{
		code: string;
	} | {
		file: string;
	}>;
}

export function insertCSS({
	tabId,
	frameId,
	files,
	allFrames,
	matchAboutBlank,
	runAt,
}: InjectionDetails): void {
	for (let content of files) {
		if (typeof content === 'string') {
			content = {file: content};
		}

		if (gotScripting) {
			void chrome.scripting.insertCSS({
				target: {
					tabId,
					frameIds: arrayOrUndefined(frameId),
					allFrames,
				},
				files: 'file' in content ? [content.file] : undefined,
				css: 'code' in content ? content.code : undefined,
			});
		} else {
			void chromeP.tabs.insertCSS(tabId, {
				...content,
				matchAboutBlank,
				allFrames,
				frameId,
				runAt: runAt ?? 'document_start', // CSS should prefer `document_start` when unspecified
			});
		}
	}
}

export async function executeScript({
	tabId,
	frameId,
	files,
	allFrames,
	matchAboutBlank,
	runAt,
}: InjectionDetails): Promise<void> {
	let lastInjection: Promise<unknown> | undefined;
	for (let content of files) {
		if (typeof content === 'string') {
			content = {file: content};
		}

		if (gotScripting) {
			if ('code' in content) {
				throw new Error('chrome.scripting does not support injecting strings of `code`');
			}

			void chrome.scripting.executeScript({
				target: {
					tabId,
					frameIds: arrayOrUndefined(frameId),
					allFrames,
				},
				files: [content.file],
			});
		} else {
			// Files are executed in order, but code isn’t, so it must wait the last script #31
			if ('code' in content) {
				// eslint-disable-next-line no-await-in-loop -- On purpose, to serialize injection
				await lastInjection;
			}

			lastInjection = chromeP.tabs.executeScript(tabId, {
				...content,
				matchAboutBlank,
				allFrames,
				frameId,
				runAt,
			});
		}
	}
}

export async function injectContentScript(
	target: number | Target,
	scripts: Manifest.ContentScript | Manifest.ContentScript[],
): Promise<void> {
	const {frameId, tabId} = typeof target === 'object' ? target : {
		tabId: target,
		frameId: 0,
	};
	const injections: Array<Promise<unknown>> = [];
	for (const script of castArray(scripts)) {
		for (const file of script.css ?? []) {
			injections.push(chromeP.tabs.insertCSS(tabId, {
				file,
				frameId,
				runAt: script.run_at,
				allFrames: script.all_frames,
				matchAboutBlank: script.match_about_blank,
			}));
		}

		for (const file of script.js ?? []) {
			injections.push(chromeP.tabs.executeScript(tabId, {
				file,
				frameId,
				runAt: script.run_at,
				allFrames: script.all_frames,
				matchAboutBlank: script.match_about_blank,
			}));
		}
	}

	await Promise.all(injections);
}
