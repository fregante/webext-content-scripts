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
	 */
	all_frames?: boolean;

	/**
	 If match_about_blank is true, then the code is also injected in about:blank and about:srcdoc frames if your extension has
	 access to its parent document. Code cannot be inserted in top-level about:-frames. By default it is <code>false</code>.
	 */
	match_about_blank?: boolean;

	/**
	 The soonest that the JavaScript or CSS will be injected into the tab. Defaults to "document_idle".
	 */
	run_at?: string;
}
