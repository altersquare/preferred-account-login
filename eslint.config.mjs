import globals from "globals";
import pluginJs from "@eslint/js";

/** @type {import('eslint').Linter.Config[]} */
export default [
	{ files: ["**/*.js"], languageOptions: { sourceType: "commonjs" } },
	{
		// Extension code is loaded as classic scripts, not modules: the names
		// src/rules.js declares are its public surface, not dead code.
		files: ["src/*.js"],
		languageOptions: { sourceType: "script" },
	},
	{
		languageOptions: {
			globals: { ...globals.browser, chrome: "readonly" },
		},
	},
	{
		// src/rules.js is loaded as a plain script before the content script
		// and the popup, so everything it declares is a global to both.
		files: ["src/content.js", "src/popup.js"],
		languageOptions: {
			globals: {
				ALL_DAYS: "readonly",
				normalizeDays: "readonly",
				normalizeDomainSetting: "readonly",
				parseTimeToMinutes: "readonly",
				isValidTimeRange: "readonly",
				isWithinActiveHours: "readonly",
				toDateKey: "readonly",
				isValidDateKey: "readonly",
				normalizeHolidays: "readonly",
				pruneHolidays: "readonly",
				getPauseRemainingMs: "readonly",
				ACTIVATION_CHECKS: "readonly",
				buildRuleContext: "readonly",
				evaluateRule: "readonly",
			},
		},
	},
	pluginJs.configs.recommended,
	{
		rules: {
			"no-prototype-builtins": "off",
		},
	},
];
