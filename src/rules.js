/* -------------------------------------------------------------------------
 * Shared rule schema and activation engine.
 *
 * Loaded as a plain script ahead of both content.js and popup.js so the two
 * surfaces can never drift on what a rule means. There is no bundler here:
 * every name below is a global inside the content-script world and inside the
 * popup page.
 *
 * Adding a new "when does this rule apply" dimension is meant to be three
 * edits in this file and nothing else in the engine:
 *   1. a field (with a safe default) in normalizeDomainSetting,
 *   2. an entry in ACTIVATION_CHECKS,
 *   3. anything the check needs to know about the world, in buildRuleContext.
 * The popup then needs a control for the new field, and collectDomainEmails-
 * FromForm needs to read it back. Import/export follow automatically, since
 * both go through normalizeDomainSetting.
 * ---------------------------------------------------------------------- */

/* exported evaluateRule, buildRuleContext, ACTIVATION_CHECKS, pruneHolidays,
   isValidTimeRange */

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

function normalizeDays(days) {
	if (!Array.isArray(days) || days.length === 0) {
		return [...ALL_DAYS];
	}

	const normalizedDays = [...new Set(days)]
		.map((day) => Number(day))
		.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
		.sort((a, b) => a - b);

	return normalizedDays.length ? normalizedDays : [...ALL_DAYS];
}

// The canonical shape of a rule. Older stored values (a bare email string, or
// an object written before a field existed) are upgraded here, so the rest of
// the code only ever sees the full shape.
function normalizeDomainSetting(value) {
	if (typeof value === "string") {
		value = { email: value };
	}

	return {
		email: value?.email || "",
		enabled: value?.enabled !== false,
		days: normalizeDays(value?.days),
		timeEnabled: Boolean(value?.timeEnabled),
		startTime: value?.startTime || "",
		endTime: value?.endTime || "",
		// Opt-in, so rules saved before holidays existed keep running on the
		// days the user marks off.
		skipOnHolidays: Boolean(value?.skipOnHolidays),
	};
}

function parseTimeToMinutes(timeValue) {
	if (!/^\d{2}:\d{2}$/.test(timeValue)) {
		return null;
	}

	const [hours, minutes] = timeValue.split(":").map(Number);
	if (
		!Number.isInteger(hours) ||
		!Number.isInteger(minutes) ||
		hours < 0 ||
		hours > 23 ||
		minutes < 0 ||
		minutes > 59
	) {
		return null;
	}

	return hours * 60 + minutes;
}

function isValidTimeRange(startTime, endTime) {
	const startMinutes = parseTimeToMinutes(startTime);
	const endMinutes = parseTimeToMinutes(endTime);

	if (startMinutes === null || endMinutes === null) {
		return false;
	}

	return endMinutes > startMinutes;
}

function isWithinActiveHours(startTime, endTime, currentMinutes) {
	const startMinutes = parseTimeToMinutes(startTime);
	const endMinutes = parseTimeToMinutes(endTime);

	if (startMinutes === null || endMinutes === null) {
		return false;
	}

	return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
}

/* --- Calendar dates ---------------------------------------------------- */

// Holiday dates are stored as "YYYY-MM-DD" in the user's own time zone.
// Date#toISOString() would be wrong here: it converts to UTC first, which
// shifts the date by a day for most of the world for part of every day.
function toDateKey(date) {
	const year = String(date.getFullYear()).padStart(4, "0");
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function isValidDateKey(value) {
	if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
		return false;
	}

	// Rejects real-looking but impossible dates such as 2026-02-31, which
	// would otherwise roll over into March and never match anything.
	const [year, month, day] = value.split("-").map(Number);
	const parsed = new Date(year, month - 1, day);
	return (
		parsed.getFullYear() === year &&
		parsed.getMonth() === month - 1 &&
		parsed.getDate() === day
	);
}

function normalizeHolidays(value) {
	if (!Array.isArray(value)) return [];

	return [...new Set(value.filter(isValidDateKey))].sort();
}

// Drops dates that have already passed, so the list does not grow forever in
// sync storage. Returns a new array; the caller decides whether to persist it.
function pruneHolidays(holidays, todayKey) {
	return normalizeHolidays(holidays).filter((date) => date >= todayKey);
}

/* --- Activation engine -------------------------------------------------- */

// Ordered from cheapest and most absolute to most specific. The first failing
// check wins and its reason is what gets reported.
const ACTIVATION_CHECKS = [
	{
		id: "enabled",
		reason: "the rule is switched off for this domain",
		test: (rule) => rule.enabled,
	},
	{
		id: "days",
		reason: "the rule does not run on this day of the week",
		test: (rule, context) => rule.days.includes(context.day),
	},
	{
		id: "time",
		reason: "the current time is outside the rule's active hours",
		test: (rule, context) =>
			!rule.timeEnabled ||
			isWithinActiveHours(rule.startTime, rule.endTime, context.minutes),
	},
	{
		id: "holiday",
		reason: "today is marked as a holiday and the rule pauses on holidays",
		test: (rule, context) =>
			!rule.skipOnHolidays || !context.holidays.includes(context.dateKey),
	},
];

// Everything a check may need to know about the world outside the rule.
function buildRuleContext({ now = new Date(), holidays = [] } = {}) {
	return {
		now,
		day: now.getDay(),
		minutes: now.getHours() * 60 + now.getMinutes(),
		dateKey: toDateKey(now),
		holidays: normalizeHolidays(holidays),
	};
}

// Returns { active, blockedBy, reason }. blockedBy is the id of the first
// check that failed, which is what makes this useful to the popup later
// (e.g. showing "paused today" next to a rule) rather than only to logging.
function evaluateRule(rule, context) {
	const normalizedRule = normalizeDomainSetting(rule);

	for (const check of ACTIVATION_CHECKS) {
		if (!check.test(normalizedRule, context)) {
			return {
				active: false,
				blockedBy: check.id,
				reason: check.reason,
			};
		}
	}

	return { active: true, blockedBy: null, reason: "" };
}
