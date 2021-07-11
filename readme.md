# webext-content-scripts [![npm version](https://img.shields.io/npm/v/webext-content-scripts.svg)](https://www.npmjs.com/package/webext-content-scripts)

> Utility functions to inject content scripts from a WebExtension.

Tested in Chrome, Firefox, and Safari.

**Sponsored by [PixieBrix](https://www.pixiebrix.com)** :tada:

## Install

You can download the [standalone bundle](https://bundle.fregante.com/?pkg=webext-content-scripts&name=window) and include it in your `manifest.json`. Or use npm:

```sh
npm install webext-content-scripts
```

```js
// This module is only offered as a ES Module
import {injectContentScript} from 'webext-content-scripts';
```

## Usage

### `injectContentScript(tabId, scripts)`

Like `chrome.tabs.executeScript` and `chrome.tabs.injectCSS` but with the same API as the manifest, so you can inject multiple JS and CSS at once. It accepts either an object or an array of objects.

```js
const tabId = 42;
injectContentScript(tabId, {
	run_at: 'document_idle',
	all_frames: true,
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
const tabId = 42;
injectContentScript(tabId, [
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

## Related

- [webext-options-sync](https://github.com/fregante/webext-options-sync) - Helps you manage and autosave your extension's options. Chrome and Firefox.
- [webext-storage-cache](https://github.com/fregante/webext-storage-cache) - Map-like promised cache storage with expiration. Chrome and Firefox
- [webext-domain-permission-toggle](https://github.com/fregante/webext-domain-permission-toggle) - Browser-action context menu to request permission for the current tab. Chrome and Firefox.
- [webext-additional-permissions](https://github.com/fregante/webext-additional-permissions) - Get any optional permissions that users have granted you.
- [webext-detect-page](https://github.com/fregante/webext-detect-page) - Detects where the current browser extension code is being run. Chrome and Firefox.
- [web-ext-submit](https://github.com/fregante/web-ext-submit) - Wrapper around Mozilla’s web-ext to submit extensions to AMO.
- [Awesome-WebExtensions](https://github.com/fregante/Awesome-WebExtensions) - A curated list of awesome resources for WebExtensions development.

## License

MIT © [Federico Brigante](https://fregante.com)
