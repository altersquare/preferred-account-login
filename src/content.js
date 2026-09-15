// Immediately invoked function expression (IIFE) to execute code on page load.
(async () => {
	try {
		// Retrieve stored settings from Chrome storage.
		const { isEnabled } = await getFromStorage("isEnabled"); // Get whether the extension is enabled.
		let { domainEmails } = await getFromStorage("domainEmails"); // Get the domain-email pairs.
		const { holidays } = await getFromStorage("holidays"); // Get the dates marked as holidays.
		const { pausedUntil } = await getFromStorage("pausedUntil"); // Get the global temporary-pause deadline, if any.

		// If on a Chrome internal page (e.g., extensions page), exit.
		if (window.location.protocol === "chrome:") return;

		// If the extension is explicitly disabled or not enabled yet (value undefined), then exit.
		if (!isEnabled) {
			console.log("Extension is disabled.");
			return;
		}

		// If the user paused everything from the popup, exit until it expires.
		if (getPauseRemainingMs(pausedUntil) > 0) {
			console.log("Extension is paused.");
			return;
		}

		if (!domainEmails || !Object.keys(domainEmails).length) {
			domainEmails = {
				"youtube.com": "user@gmail.com",
			};
			await setStorage("domainEmails", domainEmails);
		}

		// Check if the current URL's hostname is in the allowed domains list.
		// Only exact hostnames or subdomains count as a match, and the most
		// specific (longest) configured domain wins so that a rule for e.g.
		// mail.google.com takes precedence over one for google.com.
		const hostname = window.location.hostname.toLowerCase();
		const matchedDomain = Object.keys(domainEmails)
			.filter((domain) => {
				const configured = String(domain).toLowerCase();
				return (
					hostname === configured ||
					hostname.endsWith(`.${configured}`)
				);
			})
			.sort((a, b) => b.length - a.length)[0];

		// If the domain is not allowed or no email is set for it, exit.
		if (!matchedDomain) {
			console.log("Domain not allowed or no email set for this domain.");
			return;
		}

		const rule = normalizeDomainSetting(domainEmails[matchedDomain]);
		const context = buildRuleContext({ holidays });

		// Every "should this rule run right now" question is answered by the
		// shared engine in rules.js, so the popup and the content script can
		// never disagree about it.
		const verdict = evaluateRule(rule, context);
		if (!verdict.active) {
			console.log(`Rule skipped: ${verdict.reason}.`);
			return;
		}

		// Add the authuser parameter to the URL.
		await setAuthUser(rule.email);
	} catch (error) {
		console.error("Error:", error); // Log any errors.
	}
})();

async function setAuthUser(authUserEmail) {
	const LOOP_FLAG_KEY = "pgl_redirect_flag";

	// Check if we just redirected to prevent loops
	if (sessionStorage.getItem(LOOP_FLAG_KEY)) {
		sessionStorage.removeItem(LOOP_FLAG_KEY);
		// console.log("Redirect loop prevention triggered.");
		return;
	}

	try {
		const url = new URL(window.location.href);
		let modified = false;
		const hasPathAuthUser = /\/u\/\d+/.test(url.pathname);
		const pathAuthUserAttemptKey = `pgl_path_authuser_attempt:${url.hostname}${url.pathname}`;
		const hasPathAuthUserAttempt = sessionStorage.getItem(
			pathAuthUserAttemptKey
		);
		const currentAuthUser = url.searchParams.get("authuser");
		const normalizedCurrentAuthUser = currentAuthUser
			? currentAuthUser.toLowerCase()
			: "";
		const normalizedPreferredAuthUser = authUserEmail.toLowerCase();
		const isCurrentAuthUserEmail =
			!!currentAuthUser && currentAuthUser.includes("@");

		if (hasPathAuthUser) {
			if (
				!hasPathAuthUserAttempt &&
				(!currentAuthUser ||
					(isCurrentAuthUserEmail &&
						normalizedCurrentAuthUser !==
							normalizedPreferredAuthUser))
			) {
				url.searchParams.set("authuser", authUserEmail);
				modified = true;
				sessionStorage.setItem(pathAuthUserAttemptKey, "true");
			}
		} else if (!currentAuthUser) {
			url.searchParams.set("authuser", authUserEmail);
			modified = true;
		} else if (
			isCurrentAuthUserEmail &&
			normalizedCurrentAuthUser !== normalizedPreferredAuthUser
		) {
			url.searchParams.set("authuser", authUserEmail);
			modified = true;
		}

		// If we made changes (either path or query param), redirect
		if (modified) {
			// Set a session flag so we know this redirect was intentional
			sessionStorage.setItem(LOOP_FLAG_KEY, "true");
			window.location.href = url.toString();
		}
	} catch (error) {
		console.error("Error setting authuser:", error);
	}
}

/**
 * Validates the storage key to ensure it's a string.
 * @param {string} key The storage key to validate.
 * @returns {string} The validated storage key.
 * @throws {Error} If the key is not a string.
 */
function validateAndMutateKey(key) {
	if (typeof key !== "string") throw new Error("Invalid key");
	return key;
}

/**
 * Retrieves data from Chrome local storage.
 * @param {string} key The key to retrieve.
 * @returns {Promise<any>} A promise that resolves with the retrieved data.
 */
async function getFromStorage(key) {
	let storageKey = validateAndMutateKey(key); // Validate the key.
	return await chrome.storage.sync.get([storageKey]);
}

/**
 * Sets data in Chrome local storage.
 * @param {string} key The key to set.
 * @param {any} value The value to set.
 * @returns {Promise<void>} A promise that resolves when the data is set.
 */
async function setStorage(key, value) {
	let storageKey = validateAndMutateKey(key); // Validate the key.
	return await chrome.storage.sync.set({ [storageKey]: value });
}
