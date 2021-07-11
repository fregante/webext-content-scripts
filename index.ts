type ContentScripts = NonNullable<chrome.runtime.Manifest['content_scripts']>;

function castArray<A = unknown>(possibleArray: A | A[]): A[] {
	if (Array.isArray(possibleArray)) {
		return possibleArray;
	}

	return [possibleArray];
}

export async function injectContentScript(
	tabId: number,
	scripts: ContentScripts | ContentScripts[0],
): Promise<void> {
	const injections: Array<Promise<unknown>> = [];
	for (const script of castArray(scripts)) {
		for (const file of script.css ?? []) {
			injections.push(chrome.tabs.insertCSS(tabId, {
				file,
				runAt: script.run_at,
				allFrames: script.all_frames,
				matchAboutBlank: script.match_about_blank,
			}));
		}

		for (const file of script.js ?? []) {
			injections.push(chrome.tabs.executeScript(tabId, {
				file,
				runAt: script.run_at,
				allFrames: script.all_frames,
				matchAboutBlank: script.match_about_blank,
			}));
		}
	}

	await Promise.all(injections);
}
