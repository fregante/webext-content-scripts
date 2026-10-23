export type RunAt = 'document_start' | 'document_end' | 'document_idle';

/**
 A `content_scripts` entry from `manifest.json`
 */
export interface ContentScript {
	/**
	 The list of CSS files to inject
	 */
	css?: string[];

	/**
	 The list of JS files to inject
	 */
	js?: string[];

	/**
	 If all_frames is <code>true</code>, implies that the JavaScript or CSS should be injected into all frames of current page.
	 By default, it's <code>false</code> and is only injected into the top frame.
	 When injecting into a tab ID, all frames are targeted unless this is explicitly <code>false</code>. When injecting into a specific frame, this is ignored.
	 */
	all_frames?: boolean;

	/**
	 The soonest that the JavaScript will be injected into the tab. Defaults to "document_idle".
	 `document_start` injects the JavaScript as soon as possible; `document_end` and `document_idle` are treated the same. CSS is always injected as soon as possible.
	 */
	run_at?: RunAt;

	/**
	 The JavaScript world to run in. Defaults to "ISOLATED". It does not affect CSS.
	 */
	world?: 'ISOLATED' | 'MAIN';

	/**
	 Not used: scripts are injected wherever the extension has access. Programmatic injections can't opt in or out of `about:blank` frames.
	 */
	match_about_blank?: boolean;

	/**
	 Not used, see `match_about_blank`.
	 */
	match_origin_as_fallback?: boolean;

	/**
	 Not used: `matches` and the other URL filters are ignored, so the scripts can be injected on any host that the extension has access to.
	 */
	matches?: string[];

	/**
	 Not used, see `matches`.
	 */
	exclude_matches?: string[];

	/**
	 Not used, see `matches`.
	 */
	include_globs?: string[];

	/**
	 Not used, see `matches`.
	 */
	exclude_globs?: string[];
}
