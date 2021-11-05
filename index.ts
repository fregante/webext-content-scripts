type ContentScripts = NonNullable<chrome.runtime.Manifest['content_scripts']>;
import chromeP from 'webext-polyfill-kinda';

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

export async function injectContentScript(
	target: number | Target,
	scripts: ContentScripts | ContentScripts[0],
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
