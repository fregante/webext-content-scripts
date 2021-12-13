import chromeP from 'webext-polyfill-kinda';
import type {Manifest, ContentScripts, ExtensionTypes} from 'webextension-polyfill';

function castArray<A = unknown>(possibleArray: A | A[]): A[] {
	if (Array.isArray(possibleArray)) {
		return possibleArray;
	}

	return [possibleArray];
}

type MaybeArray<X> = X|Array<X>;

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

	if ('scripting' in chrome) {
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

export interface ContentScript {
	/**
	 * The list of CSS files to inject
	 */
	css?: string[] | ExtensionTypes.ExtensionFileOrCode[];

	/**
	 * The list of JS files to inject
	 */
	js?: string[] | ExtensionTypes.ExtensionFileOrCode[];

	/**
	 * Prefer `allFrames`
	 */
	all_frames?: boolean;

	/**
	 * If allFrames is <code>true</code>, implies that the JavaScript or CSS should be injected into all frames of current page.
	 * By default, it's <code>false</code> and is only injected into the top frame.
	 */
	allFrames?: boolean;

	/**
	 * Prefer `matchAboutBlank`
	 */
	match_about_blank?: boolean;

	/**
	 * If matchAboutBlank is true, then the code is also injected in about:blank and about:srcdoc frames if your extension has
	 * access to its parent document. Code cannot be inserted in top-level about:-frames. By default it is <code>false</code>.
	 */
	 matchAboutBlank?: boolean;

	/**
	 * Prefer `runAt`
	 */
	 run_at?: ExtensionTypes.RunAt;

	 /**
		* The soonest that the JavaScript or CSS will be injected into the tab. Defaults to "document_idle".
		*/
	 runAt?: ExtensionTypes.RunAt;
}

export async function injectContentScript(
	target: number | Target,
	scripts: MaybeArray<ContentScript>,
): Promise<void> {
	const {frameId, tabId} = typeof target === 'object' ? target : {
		tabId: target,
		frameId: 0,
	};
	const injections: Array<Promise<unknown>> = [];

	for (const script of castArray(scripts)) {
		for (const file of script.css ?? []) {
			const content = typeof file === 'string' ? {file} : file;
			injections.push(chromeP.tabs.insertCSS(tabId, {
				...content,
				frameId,
				runAt: script.runAt ?? script.run_at,
				allFrames: script.allFrames ?? script.all_frames,
				matchAboutBlank: script.matchAboutBlank ?? script.match_about_blank,
			}));
		}

		for (const file of script.js ?? []) {
			const content = typeof file === 'string' ? {file} : file;
			injections.push(chromeP.tabs.executeScript(tabId, {
				...content,
				frameId,
				runAt: script.runAt ?? script.run_at,
				allFrames: script.allFrames ?? script.all_frames,
				matchAboutBlank: script.matchAboutBlank ?? script.match_about_blank,
			}));
		}
	}

	await Promise.all(injections);
}
