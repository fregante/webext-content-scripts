import chromeP from 'webext-polyfill-kinda';
import type {Manifest} from 'webextension-polyfill';

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
