/* -------------------------------------------------------------------------
 * Theme bootstrap.
 *
 * Loaded synchronously from <head>, ahead of any markup, so the popup paints
 * in the right theme on the first frame. Reading the choice from chrome
 * .storage instead would land a frame or two late and flash the light theme
 * at a dark-theme user every time the popup opens.
 *
 * That is also why the choice lives in localStorage rather than next to the
 * rules in chrome.storage.sync: localStorage reads synchronously. It makes
 * the theme a per-profile preference that does not follow the user to another
 * machine, which suits a setting about the screen in front of them.
 *
 * Light is the default, including for a user whose system is set to dark.
 * ---------------------------------------------------------------------- */

(function applyStoredTheme() {
	let stored = null;

	try {
		stored = localStorage.getItem("pal-theme");
	} catch {
		// Storage can be unavailable when site data is blocked. The default
		// below still gives a readable popup.
	}

	document.documentElement.dataset.theme =
		stored === "dark" ? "dark" : "light";
})();
