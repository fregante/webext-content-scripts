import type {ContentScript} from './types.js';

export type * from './types.js';

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
	return typeof target === 'object'
		? target
		: {
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
	return Array.isArray(possibleArray) ? possibleArray : [possibleArray];
}

function dedupeFiles(files: string[], seen: string[]): string[] {
	return files.filter(file => {
		if (seen.includes(file)) {
			console.debug(`Duplicated file not injected: ${file}`);
			return false;
		}

		seen.push(file);
		return true;
	});
}

type MaybeArray<X> = X | X[];

function getInjectionTarget(tabId: number, frameId?: number, isAllFrames?: boolean): chrome.scripting.InjectionTarget {
	if (frameId !== undefined) {
		return {tabId, frameIds: [frameId]};
	}

	return isAllFrames === true
		? {tabId, allFrames: true}
		: {tabId};
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
	{ignoreTargetErrors}: InjectionOptions = {},
): Promise<void> {
	const seen: string[] = [];
	const injections = castArray(scripts).flatMap(script => {
		// Explicit `all_frames: false` limits tab-wide injections to the top frame, like in the manifest
		const target = getInjectionTarget(tabId, frameId, allFrames && script.all_frames !== false);
		const css = dedupeFiles(script.css ?? [], seen);
		const js = dedupeFiles(script.js ?? [], seen);
		return [
			// One file at a time, according to the types
			...css.map(async file => chrome.scripting.insertCSS({target, files: [file]})),
			...(js.length > 0
				? [chrome.scripting.executeScript({
					target,
					files: js,
					world: script.world,
					// `document_end` and `document_idle` are the same as the default behavior
					injectImmediately: script.run_at === 'document_start' ? true : undefined,
				})]
				: []),
		];
	});

	// Don't return the results; the "return value" of a file is generally not useful
	await Promise.all(injections.map(async injection => ignoreTargetErrors
		? catchTargetInjectionErrors(injection)
		: injection));
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

	const cleanUrl = url.replace(/^https?:\/\//v, '');
	return blockedPrefixes.every(blocked => !cleanUrl.startsWith(blocked));
}

const targetErrors = /^No frame with id \d+ in tab \d+.$|^No tab with id: \d+.$|^The tab was closed.$|^The frame was removed.$/v;

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
		await assertTabAccess(target);
		return true;
	} catch {
		return false;
	}
}

export async function assertTabAccess(
	target: number | Target,
): Promise<void> {
	const {tabId, frameId} = castTarget(target);
	await chrome.scripting.executeScript({
		target: {
			tabId,
			frameIds: [frameId],
		},
		func: () => true,
	});
}
