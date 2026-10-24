# webext-content-scripts [![npm version](https://img.shields.io/npm/v/webext-content-scripts.svg)](https://www.npmjs.com/package/webext-content-scripts)

> Utility functions to inject content scripts in WebExtensions, for Manifest v3.

- Browsers: Chrome, Firefox, and Safari
- Manifest: v3
- Permissions: `scripting`
- Context: They can be called from any context that has access to the `chrome.tabs` or `chrome.scripting` APIs

**Sponsored by [PixieBrix](https://www.pixiebrix.com)** :tada:

## Install

You can download the [standalone bundle](https://bundle.fregante.com/?pkg=webext-content-scripts&name=window) and include it in your `manifest.json`. Or use npm:

```sh
npm install webext-content-scripts
```

```js
// This module is only offered as a ES Module
import {
	injectContentScript,
	canAccessTab,
	assertTabAccess,
} from 'webext-content-scripts';
```

## Usage

### `injectContentScript(targets, scripts)`

It combines `chrome.scripting.executeScript` and `chrome.scripting.insertCSS` in a single call. It accepts `content_scripts` entries in the same format as `manifest.json` (`snake_case_keys`, files only), so you can pass the array from the manifest as is. It accepts either an object or an array of objects.

### targets

This can be a tab ID, an array of tab IDs, a specific tab/frame combination, an array of such combinations:

```js
injectContentScript(1, scripts);
injectContentScript([1, 2], scripts)
injectContentScript({tabId: 1, frameId: 0}, scripts);
injectContentScript([{tabId: 1, frameId: 0}, {tabId: 23, frameId: 98765}], scripts);
```

You can also use [`queryTabsByUrl`](https://github.com/fregante/webext-tools/blob/main/source/query-tabs-by-url.md) from `webext-tools` to inject by URL:

```js
import queryTabsByUrl from 'webext-tools/query-tabs-by-url.js';
injectContentScript(await queryTabsByUrl(['https://example.com/*']), scripts);
```

### Examples

```js
const tabId = 42;
await injectContentScript(tabId, {
	run_at: 'document_idle',
	all_frames: true, // Default when passing frame-less tab IDs
	match_about_blank: true,
	js: [
		'contentscript.js'
	],
	css: [
		'style.css'
	],
})
```

```js
await injectContentScript({
	tabId: 42,
	frameId: 56
}, [
	{
		js: [
			'jquery.js',
			'contentscript.js'
		],
		css: [
			'bootstrap.css',
			'style.css'
		],
	},
	{
	run_at: 'document_start',
		css: [
			'more-styles.css'
		],
	}
])
```

```js
const tabId = 42;
const scripts = browser.runtime.getManifest().content_scripts;
// `matches`, `exclude_matches`, etc are ignored, so you can inject them on any host that you have permission to
await injectContentScript(tabId, scripts);
```

### `canAccessTab(tabId)`

### `canAccessTab({tabId, frameId})`

Checks whether the extension has access to a specific tab or frame (i.e. content scripts are allowed to run), either via `activeTab` permission or regular host permissions.

```js
const tabId = 42;
const access = await canAccessTab(tabId);
if (access) {
	console.log('We can access this tab');
	chrome.scripting.executeScript({target: {tabId}, files: ['my-script.js']});
} else {
	console.warn('We have no access to the tab');
}
```

```js
const access = await canAccessTab({
	tabId: 42,
	frameId: 56,
});
if (access) {
	console.log('We can access this frame');
	chrome.tabs.executeScript(42, {file: 'my-script.js', frameId: 56});
} else {
	console.warn('We have no access to the frame');
}
```

### `assertTabAccess(tabId)`

### `assertTabAccess({tabId, frameId})`

Like `canAccessTab`, but instead of returning `false` on failure it throws whatever error the browser throws.

Note that you don't need to verify access before calling `chrome.scripting.executeScript`, just call it directly and it will throw exactly the same way.

```js
const tabId = 42;
await assertTabAccess(tabId); // throws if the extension has no access
chrome.tabs.repload(tabId);
```

### `isScriptableUrl(url)`

Browsers block access to some URLs for security reasons. This function will check whether a passed URL is blocked. Permissions and the manifest are not checked, this function is completely static. It will also returns `false` for any URL that doesn't start with `http`.

More info may be found on:

- https://stackoverflow.com/q/11613371/288906
- https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Content_scripts

```js
const url = 'https://addons.mozilla.org/en-US/firefox/addon/ghosttext/';
if (isScriptableUrl(url)) {
	console.log('I can inject content script to this page if permitted');
} else {
	console.log('Content scripts are never allowed on this page');
}
```

## Related

- [webext-tools](https://github.com/fregante/webext-tools) - Utility functions for Web Extensions.
- [webext-permission-toggle](https://github.com/fregante/webext-permission-toggle) - Browser-action context menu to request permission for the current tab.
- [webext-permissions](https://github.com/fregante/webext-permissions) - Get any optional permissions that users have granted you.
- [webext-dynamic-content-scripts](https://github.com/fregante/webext-dynamic-content-scripts) - Automatically registers your content_scripts on domains added via permission.request
- [More…](https://github.com/fregante/webext-fun)

## License

MIT © [Federico Brigante](https://fregante.com)
