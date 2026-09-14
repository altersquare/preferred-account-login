// Global array of Google domains
const googleDomains = {
	google: "google.com",
	maps: "maps.google.com",
	news: "news.google.com",
	gemini: "gemini.google.com",
	translate: "translate.google.com",
	drive: "drive.google.com",
	docs: "docs.google.com",
	gmail: "mail.google.com",
	photos: "photos.google.com",
	keep: "keep.google.com",
	meet: "meet.google.com",
	classroom: "classroom.google.com",
	play: "play.google.com",
	developers: "developers.google.com",
	cloud: "cloud.google.com",
	adsense: "adsense.google.com",
	business: "business.google.com",
	merchants: "merchants.google.com",
	tagmanager: "tagmanager.google.com",
	marketingplatform: "marketingplatform.google.com",
	youtube: "youtube.com",
	studio: "studio.youtube.com",
	artsandculture: "artsandculture.google.com",
	store: "store.google.com",
	wearos: "wearos.google.com",
	domains: "domains.google.com",
	fi: "fi.google.com",
	one: "one.google.com",
	pay: "pay.google.com",
	shopping: "shopping.google.com",
	fonts: "fonts.google.com",
	labs: "labs.google.com",
	ai: "ai.google",
};

// Domain roots the extension can run on, mirroring the host_permissions
// and content-script match patterns in manifest.json.
const GOOGLE_DOMAIN_ROOTS = ["google.com", "youtube.com", "ai.google"];

function normalizeDomainInput(input) {
	const raw = String(input || "")
		.trim()
		.toLowerCase();
	if (!raw) return "";

	try {
		const withScheme = raw.includes("://") ? raw : `https://${raw}`;
		return new URL(withScheme).hostname;
	} catch {
		return "";
	}
}

function isValidGoogleHostname(hostname) {
	if (!hostname) return false;
	return GOOGLE_DOMAIN_ROOTS.some(
		(root) => hostname === root || hostname.endsWith(`.${root}`)
	);
}

// Resolve whatever the user typed — a friendly key from the dropdown
// ("gmail"), a hostname ("docs.google.com"), or a pasted URL — to the
// hostname used as the storage key. Returns null for anything the
// extension cannot run on.
function resolveDomainInput(input) {
	const raw = String(input || "")
		.trim()
		.toLowerCase();
	if (googleDomains[raw]) return googleDomains[raw];
	const hostname = normalizeDomainInput(raw);
	return isValidGoogleHostname(hostname) ? hostname : null;
}

function setErrorMessage(element, message = "") {
	element.textContent = message;
	element.style.display = message ? "block" : "none";
}

/* -------------------------------------------------------------------------
 * Holidays
 *
 * One shared list of dates, stored under "holidays" next to the rules. Rules
 * opt in individually with "Pause on holidays", so marking a date off silences
 * those rules and leaves every other rule running.
 *
 * Dates behave like every other edit in this popup: marking or clearing one
 * shows on screen and enables Save Changes, and only Save Changes writes it.
 * Closing the popup discards it.
 * ---------------------------------------------------------------------- */

let holidayDates = [];

// Set while the dates on screen differ from the ones in storage, whether they
// were marked by hand or loaded from an imported file. Save Changes writes
// them and clears this; closing the popup drops them.
let holidaysPendingSave = false;

function getTodayKey() {
	return toDateKey(new Date());
}

function formatDateKey(dateKey) {
	const [year, month, day] = dateKey.split("-").map(Number);
	return new Date(year, month - 1, day).toLocaleDateString(undefined, {
		weekday: "short",
		day: "numeric",
		month: "short",
	});
}

// Reloading the active tab is only a convenience, so a failure here is not
// worth surfacing. tabs.reload() with no arguments reloads the selected tab of
// the current window and, unlike scripting.executeScript() or reading a tab's
// url, needs no permission of its own — which keeps the manifest down to
// "storage".
async function reloadActiveTab() {
	try {
		await chrome.tabs.reload();
	} catch (error) {
		console.warn("Could not reload active tab:", error);
	}
}

async function persistHolidays() {
	holidayDates = normalizeHolidays(holidayDates);
	await setStorage("holidays", holidayDates);
	holidaysPendingSave = false;
}

// Puts an edit on screen and hands it to Save Changes, which is what writes it
// and reloads the tab so the change takes hold.
function stageHolidayEdit() {
	holidaysPendingSave = true;
	renderHolidays();
	enableSaveButton();
}

function renderHolidays() {
	const todayKey = getTodayKey();
	const todayToggle = document.getElementById("holidayTodayToggle");
	const chips = document.getElementById("holidayChips");

	todayToggle.checked = holidayDates.includes(todayKey);
	document.getElementById("holidayTodayDate").textContent =
		formatDateKey(todayKey);

	chips.innerHTML = "";
	for (const date of holidayDates) {
		const chip = document.createElement("span");
		chip.className = `holiday-chip${date === todayKey ? " today" : ""}`;

		const label = document.createElement("span");
		label.textContent = formatDateKey(date);
		chip.appendChild(label);

		const removeButton = document.createElement("button");
		removeButton.type = "button";
		removeButton.className = "holiday-chip-remove";
		removeButton.textContent = "×";
		removeButton.title = `Remove ${date}`;
		removeButton.addEventListener("click", () => {
			holidayDates = holidayDates.filter((value) => value !== date);
			stageHolidayEdit();
		});
		chip.appendChild(removeButton);

		chips.appendChild(chip);
	}
}

async function setupHolidays() {
	const todayKey = getTodayKey();
	const todayToggle = document.getElementById("holidayTodayToggle");
	const dateInput = document.getElementById("holidayDateInput");
	const addButton = document.getElementById("holidayAddButton");
	const errorMessage = document.getElementById("holidayError");

	const { holidays } = await getFromStorage("holidays");
	const stored = normalizeHolidays(holidays);
	holidayDates = pruneHolidays(stored, todayKey);

	// Dates that have already passed can never match again, so drop them on
	// the way in and keep sync storage small.
	if (holidayDates.length !== stored.length) {
		await setStorage("holidays", holidayDates);
	}

	dateInput.min = todayKey;

	todayToggle.addEventListener("change", () => {
		setErrorMessage(errorMessage);
		holidayDates = todayToggle.checked
			? [...holidayDates, todayKey]
			: holidayDates.filter((date) => date !== todayKey);
		stageHolidayEdit();
	});

	addButton.addEventListener("click", () => {
		const date = dateInput.value;

		if (!isValidDateKey(date)) {
			setErrorMessage(errorMessage, "Pick a date first");
			return;
		}
		if (date < getTodayKey()) {
			setErrorMessage(errorMessage, "That date has already passed");
			return;
		}
		if (holidayDates.includes(date)) {
			setErrorMessage(errorMessage, "That date is already marked");
			return;
		}

		setErrorMessage(errorMessage);
		holidayDates = [...holidayDates, date];
		dateInput.value = "";
		stageHolidayEdit();
	});

	renderHolidays();
}

document.addEventListener("DOMContentLoaded", handleDOMLoad);

async function handleDOMLoad() {
	const toggle = document.getElementById("authuserToggle");
	const domainEmailList = document.getElementById("domainEmailList");
	const addButton = document.getElementById("addButton");
	const saveButton = document.getElementById("saveButton");

	// Load the toggle state from storage
	let { isEnabled } = await getFromStorage("isEnabled");
	if (!isEnabled) isEnabled = false;
	toggle.checked = isEnabled;

	// Save the toggle state when it changes
	toggle.addEventListener("change", async () => {
		await setStorage("isEnabled", toggle.checked);
		enableSaveButton();
	});

	// Add a new domain-email pair
	addButton.addEventListener("click", () => {
		addDomainEmailPair(domainEmailList);
		domainEmailList.scrollTop = domainEmailList.scrollHeight;
		enableSaveButton();
	});

	// Save changes. The markup only carries the "disabled" class, which greys
	// the button out without blocking a click; match the property to it so an
	// untouched popup cannot fire a save and reload the tab.
	saveButton.disabled = true;
	saveButton.addEventListener("click", handleSaveClick);

	// Back up the rules to a file, or load them back in
	const importFile = document.getElementById("importFile");
	document
		.getElementById("exportButton")
		.addEventListener("click", handleExportClick);
	document
		.getElementById("importButton")
		.addEventListener("click", () => importFile.click());
	importFile.addEventListener("change", handleImportFile);

	await setupHolidays();

	// Load domainEmails from storage
	let { domainEmails } = await getFromStorage("domainEmails");

	// Set default domainEmails if none exist
	if (!domainEmails || !Object.keys(domainEmails).length) {
		domainEmails = {
			"youtube.com": {
				email: "user@gmail.com",
				enabled: true,
				days: [...ALL_DAYS],
			},
		};
		await setStorage("domainEmails", domainEmails);
	}

	// Populate the domain-email list
	populateDomainEmailList(domainEmailList, domainEmails);
}

function getKeyFromDomain(domain) {
	return (
		Object.keys(googleDomains).find(
			(key) => googleDomains[key] === domain
		) || null
	);
}

function populateDomainEmailList(container, domainEmails) {
	container.innerHTML = "";

	for (const [domain, value] of Object.entries(domainEmails)) {
		const {
			email,
			enabled,
			days,
			timeEnabled,
			startTime,
			endTime,
			skipOnHolidays,
		} = normalizeDomainSetting(value);

		addDomainEmailPair(
			container,
			getKeyFromDomain(domain) || domain,
			email,
			enabled,
			days,
			timeEnabled,
			startTime,
			endTime,
			skipOnHolidays
		);
	}
}

function addDomainEmailPair(
	container,
	domain = "",
	email = "",
	enabled = true,
	days = [...ALL_DAYS],
	timeEnabled = false,
	startTime = "",
	endTime = "",
	skipOnHolidays = false
) {
	const domainEmailContainer = document.createElement("div");
	domainEmailContainer.className = "domain-email-container";

	// Toggle Switch
	const toggleWrapper = document.createElement("label");
	toggleWrapper.className = "switch";
	const toggleInput = document.createElement("input");
	toggleInput.type = "checkbox";
	toggleInput.checked = enabled;
	toggleInput.addEventListener("change", enableSaveButton);

	const slider = document.createElement("span");
	slider.className = "slider"; // Removed 'round' as border-radius is handled in CSS

	toggleWrapper.appendChild(toggleInput);
	toggleWrapper.appendChild(slider);

	domainEmailContainer.appendChild(toggleWrapper);

	// Content Wrapper (Inputs + Days)
	const contentWrapper = document.createElement("div");
	contentWrapper.className = "content-wrapper";

	// Inputs Row
	const inputsRow = document.createElement("div");
	inputsRow.className = "inputs-row";

	const listContainer = document.createElement("div");
	listContainer.className = "input-domain-container"; // Add class for styling

	// Domain input with custom dropdown
	const domainInput = document.createElement("input");
	domainInput.className = "domain-input";
	domainInput.type = "text";
	domainInput.placeholder = "Service or Google domain...";
	domainInput.value = domain;
	// Remove native autocomplete
	domainInput.setAttribute("autocomplete", "off");
	listContainer.appendChild(domainInput);

	// Custom dropdown container
	const dropdownList = document.createElement("div");
	dropdownList.className = "dropdown-list";
	listContainer.appendChild(dropdownList);

	const domainErrorMessage = document.createElement("div");
	domainErrorMessage.className = "error-message domain-error-message";
	domainErrorMessage.textContent = "";
	listContainer.appendChild(domainErrorMessage);

	inputsRow.appendChild(listContainer);

	const emailContainer = document.createElement("div");
	emailContainer.className = "input-email-container"; // Add class for styling
	// Email input

	const emailInput = document.createElement("input");
	emailInput.type = "text";
	emailInput.placeholder = "Enter email...";
	emailInput.value = email;
	emailContainer.appendChild(emailInput);

	const emailErrorMessage = document.createElement("div");
	emailErrorMessage.className = "error-message email-error-message";
	emailErrorMessage.textContent = "";
	emailContainer.appendChild(emailErrorMessage);

	inputsRow.appendChild(emailContainer);

	// Remove button with trash icon
	const removeButton = document.createElement("div");
	removeButton.className = "remove-button";
	removeButton.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;
	removeButton.title = "Remove";
	removeButton.addEventListener("click", async () => {
		// The input holds a friendly key (e.g. "gmail") or a hostname;
		// storage is keyed by the resolved domain (e.g. "mail.google.com").
		const mappedDomain = resolveDomainInput(domainInput.value);
		let { domainEmails } = await getFromStorage("domainEmails");
		if (domainEmails && mappedDomain && mappedDomain in domainEmails) {
			delete domainEmails[mappedDomain];
			await setStorage("domainEmails", domainEmails);
		}
		if (!domainEmails || !Object.keys(domainEmails).length) {
			domainEmails = {
				"youtube.com": {
					email: "user@gmail.com",
					enabled: true,
					days: [...ALL_DAYS],
				},
			};
			await setStorage("domainEmails", domainEmails);
		}
		container.removeChild(domainEmailContainer);
		enableSaveButton();
	});
	inputsRow.appendChild(removeButton);

	contentWrapper.appendChild(inputsRow);

	// Days Row
	const daysRow = document.createElement("div");
	daysRow.className = "days-row";

	const dayLabels = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
	const fullDayNames = [
		"Sunday",
		"Monday",
		"Tuesday",
		"Wednesday",
		"Thursday",
		"Friday",
		"Saturday",
	];

	const daysErrorMessage = document.createElement("div");
	daysErrorMessage.className = "error-message days-error-message";

	function validateDays() {
		const hasSelectedDay = daysRow.querySelector(".day-btn.selected");
		setErrorMessage(
			daysErrorMessage,
			hasSelectedDay ? "" : "Select at least one day"
		);
		return Boolean(hasSelectedDay);
	}

	dayLabels.forEach((label, index) => {
		const btn = document.createElement("button");
		btn.className = "day-btn";
		btn.textContent = label;
		btn.dataset.day = index;
		btn.title = fullDayNames[index];
		btn.type = "button"; // Prevent form submission behavior
		if (days.includes(index)) {
			btn.classList.add("selected");
		}
		btn.addEventListener("click", () => {
			btn.classList.toggle("selected");
			validateDays();
			enableSaveButton();
		});
		daysRow.appendChild(btn);
	});

	contentWrapper.appendChild(daysRow);
	contentWrapper.appendChild(daysErrorMessage);

	const timeRow = document.createElement("div");
	timeRow.className = "time-row";

	const timeToggleLabel = document.createElement("label");
	timeToggleLabel.className = "time-toggle-label";

	const timeToggle = document.createElement("input");
	timeToggle.type = "checkbox";
	timeToggle.className = "time-toggle";
	timeToggle.checked = timeEnabled;

	const timeToggleText = document.createElement("span");
	timeToggleText.textContent = "Active hours";

	timeToggleLabel.appendChild(timeToggle);
	timeToggleLabel.appendChild(timeToggleText);
	timeRow.appendChild(timeToggleLabel);

	const timeFields = document.createElement("div");
	timeFields.className = "time-fields";

	const startTimeInput = document.createElement("input");
	startTimeInput.type = "time";
	startTimeInput.className = "time-input start-time-input";
	startTimeInput.value = startTime;

	const timeSeparator = document.createElement("span");
	timeSeparator.className = "time-separator";
	timeSeparator.textContent = "to";

	const endTimeInput = document.createElement("input");
	endTimeInput.type = "time";
	endTimeInput.className = "time-input end-time-input";
	endTimeInput.value = endTime;

	timeFields.appendChild(startTimeInput);
	timeFields.appendChild(timeSeparator);
	timeFields.appendChild(endTimeInput);
	timeRow.appendChild(timeFields);
	contentWrapper.appendChild(timeRow);

	const timeErrorMessage = document.createElement("div");
	timeErrorMessage.className = "error-message time-error-message";
	timeRow.appendChild(timeErrorMessage);

	// Opting this rule out of the dates marked in the header. Rules that leave
	// it unchecked keep running on a holiday.
	const holidayRow = document.createElement("div");
	holidayRow.className = "holiday-row";

	const holidayToggleLabel = document.createElement("label");
	holidayToggleLabel.className = "time-toggle-label";
	holidayToggleLabel.title =
		"Skip this rule on the dates marked as holidays above";

	const holidayToggle = document.createElement("input");
	holidayToggle.type = "checkbox";
	holidayToggle.className = "holiday-toggle";
	holidayToggle.checked = skipOnHolidays;
	holidayToggle.addEventListener("change", enableSaveButton);

	const holidayToggleText = document.createElement("span");
	holidayToggleText.textContent = "Pause on holidays";

	holidayToggleLabel.appendChild(holidayToggle);
	holidayToggleLabel.appendChild(holidayToggleText);
	holidayRow.appendChild(holidayToggleLabel);
	contentWrapper.appendChild(holidayRow);

	domainEmailContainer.appendChild(contentWrapper);

	// Add the row to the container
	container.appendChild(domainEmailContainer);

	// Function to check input fields and enable/disable the add button
	function checkInputs() {
		const addButton = document.getElementById("addButton");
		const domainValue = domainInput.value.trim();

		const isValidDomain = resolveDomainInput(domainValue) !== null;
		const isValidEmail = validateEmail(emailInput.value.trim());

		if (domainValue && isValidDomain && isValidEmail) {
			addButton.classList.remove("disabled");
		} else {
			addButton.classList.add("disabled");
		}
	}

	// Listen for input events to update button state
	domainInput.addEventListener("input", checkInputs);
	emailInput.addEventListener("input", checkInputs);
	// Call checkInputs initially to disable button if inputs are empty
	checkInputs();

	function validateTimeInputs() {
		if (!timeToggle.checked) {
			setErrorMessage(timeErrorMessage);
			return true;
		}

		const hasStartTime = Boolean(startTimeInput.value);
		const hasEndTime = Boolean(endTimeInput.value);

		if (!hasStartTime && !hasEndTime) {
			setErrorMessage(timeErrorMessage);
			return true;
		}

		if (!hasStartTime || !hasEndTime) {
			setErrorMessage(
				timeErrorMessage,
				"Start and end time are required"
			);
			return false;
		}

		if (!isValidTimeRange(startTimeInput.value, endTimeInput.value)) {
			setErrorMessage(
				timeErrorMessage,
				"End time must be later than start time"
			);
			return false;
		}

		setErrorMessage(timeErrorMessage);
		return true;
	}

	function syncTimeFieldState({ clearValues = false } = {}) {
		const isTimeRestricted = timeToggle.checked;
		timeFields.classList.toggle("hidden", !isTimeRestricted);
		startTimeInput.disabled = !isTimeRestricted;
		endTimeInput.disabled = !isTimeRestricted;

		if (!isTimeRestricted && clearValues) {
			startTimeInput.value = "";
			endTimeInput.value = "";
		}

		validateTimeInputs();
	}

	timeToggle.addEventListener("change", () => {
		enableSaveButton();
		syncTimeFieldState({ clearValues: !timeToggle.checked });
	});

	[startTimeInput, endTimeInput].forEach((input) => {
		input.addEventListener("input", () => {
			enableSaveButton();
			validateTimeInputs();
		});
	});

	syncTimeFieldState();

	// Validation for email input
	emailInput.addEventListener("input", () => {
		enableSaveButton();

		const emailValue = emailInput.value.trim();

		if (emailValue === "") {
			setErrorMessage(emailErrorMessage, "Email is required");
		} else if (!validateEmail(emailValue)) {
			setErrorMessage(emailErrorMessage, "Invalid email format");
		} else {
			setErrorMessage(emailErrorMessage);
		}
	});

	// Populate dropdown with options
	function updateDropdown(inputValue = "") {
		dropdownList.innerHTML = "";
		let hasMatches = false;

		Object.entries(googleDomains).forEach(([key, value]) => {
			if (
				key.toLowerCase().includes(inputValue.toLowerCase()) ||
				value.toLowerCase().includes(inputValue.toLowerCase())
			) {
				hasMatches = true;
				const item = document.createElement("div");
				item.className = "dropdown-item";
				item.innerHTML = `<strong>${
					key.charAt(0).toUpperCase() + key.slice(1)
				}</strong> <small>(${value})</small>`;

				item.addEventListener("mousedown", (e) => {
					e.preventDefault(); // Prevent input blur
					domainInput.value = key;
					dropdownList.classList.remove("show");
					domainEmailContainer.classList.remove("active-editing");
					checkInputs();
					validateDomain(); // Trigger validation
				});

				dropdownList.appendChild(item);
			}
		});

		if (hasMatches) {
			dropdownList.classList.add("show");
			// Lift the parent container above others
			domainEmailContainer.classList.add("active-editing");
		} else {
			dropdownList.classList.remove("show");
			domainEmailContainer.classList.remove("active-editing");
		}
	}

	// Input event listeners
	domainInput.addEventListener("focus", () => {
		updateDropdown(domainInput.value.trim());
	});

	domainInput.addEventListener("input", () => {
		updateDropdown(domainInput.value.trim());
		checkInputs();
		validateDomain();
	});

	// Close dropdown when clicking outside
	document.addEventListener("click", (e) => {
		if (!listContainer.contains(e.target)) {
			dropdownList.classList.remove("show");
			domainEmailContainer.classList.remove("active-editing");
		}
	});

	function validateDomain() {
		const inputValue = domainInput.value.trim();
		const resolved = resolveDomainInput(inputValue);

		// Compare resolved domains so "gmail" and "mail.google.com" count
		// as the same rule.
		const resolvedDomains = Array.from(
			container.querySelectorAll(".domain-input")
		)
			.map((input) => resolveDomainInput(input.value))
			.filter(Boolean);

		const isDuplicate =
			resolved &&
			resolvedDomains.filter((d) => d === resolved).length > 1;

		setErrorMessage(domainErrorMessage);

		if (!inputValue) {
			setErrorMessage(domainErrorMessage, "Domain is required");
		} else if (!resolved) {
			setErrorMessage(domainErrorMessage, "Invalid Google domain");
		} else if (isDuplicate) {
			setErrorMessage(domainErrorMessage, "Already added");
		}
		enableSaveButton();
	}
}

function validateEmail(email) {
	const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	return regex.test(email);
}

// Reads every rule row out of the form, showing inline errors against any row
// that fails validation. Returns null if at least one row is invalid, so the
// caller can bail out. Shared by Save Changes and Export so the two always
// agree on what counts as a valid rule.
function collectDomainEmailsFromForm() {
	const domainEmailContainers = document.querySelectorAll(
		".domain-email-container"
	);

	const domainEmails = {};

	let isValid = true;
	const seenDomains = new Set(); // Track domains already processed

	domainEmailContainers.forEach((container) => {
		const domainInput = container.querySelector(".domain-input");
		const emailInput = container.querySelector(
			".input-email-container input"
		);
		const toggleInput = container.querySelector(
			".switch input[type='checkbox']"
		);
		const domainErrorMessage = container.querySelector(
			".domain-error-message"
		);
		const emailErrorMessage = container.querySelector(
			".email-error-message"
		);
		const timeErrorMessage = container.querySelector(".time-error-message");
		const daysErrorMessage = container.querySelector(".days-error-message");
		const timeToggleInput = container.querySelector(".time-toggle");
		const holidayToggleInput = container.querySelector(".holiday-toggle");
		const startTimeInput = container.querySelector(".start-time-input");
		const endTimeInput = container.querySelector(".end-time-input");

		const domain = domainInput.value.trim();
		const email = emailInput.value.trim();
		const enabled = toggleInput ? toggleInput.checked : true;
		const timeEnabled = timeToggleInput ? timeToggleInput.checked : false;
		const skipOnHolidays = holidayToggleInput
			? holidayToggleInput.checked
			: false;
		const startTime = startTimeInput ? startTimeInput.value : "";
		const endTime = endTimeInput ? endTimeInput.value : "";

		setErrorMessage(domainErrorMessage);
		setErrorMessage(emailErrorMessage);
		setErrorMessage(timeErrorMessage);
		setErrorMessage(daysErrorMessage);

		// Prevent saving if both domain and email are empty
		if (!domain || !email) {
			isValid = false;
			if (!domain) {
				setErrorMessage(domainErrorMessage, "Domain is required");
			}
			if (!email) {
				setErrorMessage(emailErrorMessage, "Email is required");
			}
			return;
		}

		// Resolve a friendly key, hostname, or pasted URL to the domain
		// used as the storage key.
		const mappedDomain = resolveDomainInput(domain);
		if (!mappedDomain) {
			isValid = false;
			setErrorMessage(domainErrorMessage, "Invalid Google domain");
			return;
		}

		// Check if domain is already processed
		if (seenDomains.has(mappedDomain)) {
			isValid = false;
			setErrorMessage(domainErrorMessage, "Domain already exists");
			return;
		}

		// Mark domain as processed
		seenDomains.add(mappedDomain);

		// Check if email is valid
		if (!validateEmail(email)) {
			isValid = false;
			setErrorMessage(emailErrorMessage, "Invalid email format");
			return;
		}

		// Get selected days
		const dayBtns = container.querySelectorAll(".day-btn.selected");
		if (!dayBtns.length) {
			isValid = false;
			setErrorMessage(daysErrorMessage, "Select at least one day");
			return;
		}
		const days = Array.from(dayBtns)
			.map((btn) => parseInt(btn.dataset.day))
			.sort((a, b) => a - b);

		if (timeEnabled) {
			if (!startTime || !endTime) {
				isValid = false;
				setErrorMessage(
					timeErrorMessage,
					"Start and end time are required"
				);
				return;
			}

			if (!isValidTimeRange(startTime, endTime)) {
				isValid = false;
				setErrorMessage(
					timeErrorMessage,
					"End time must be later than start time"
				);
				return;
			}
		}

		// Save the domain-email pair
		// Optional fields are only written when switched on, so a rule that
		// uses none of them stays as small in storage as it always was.
		domainEmails[mappedDomain] = {
			email,
			enabled,
			days,
			...(timeEnabled ? { timeEnabled: true, startTime, endTime } : {}),
			...(skipOnHolidays ? { skipOnHolidays: true } : {}),
		};
	});

	return isValid ? domainEmails : null;
}

async function handleSaveClick() {
	setTransferStatus();

	const domainEmails = collectDomainEmailsFromForm();
	if (!domainEmails) {
		return;
	}

	try {
		await setStorage("domainEmails", domainEmails);
		// Left alone unless a date was marked, cleared, or imported this time
		// round.
		if (holidaysPendingSave) {
			await persistHolidays();
		}
	} catch (error) {
		console.error("Failed to save settings:", error);
		const saveButton = document.getElementById("saveButton");
		const originalText = saveButton.textContent;
		saveButton.textContent = "Error Saving";
		saveButton.classList.add("disabled");
		setTimeout(() => {
			saveButton.textContent = originalText;
			saveButton.classList.remove("disabled");
		}, 2000);
		return;
	}

	// Confirm the save to the user. Shown regardless of whether the tab
	// reload below succeeds, since the settings are already persisted. The
	// button stays disabled until the next edit re-enables it.
	const saveButton = document.getElementById("saveButton");
	saveButton.textContent = "Saved ✓";
	saveButton.classList.add("disabled");
	saveButton.disabled = true;
	setTimeout(() => {
		saveButton.textContent = "Save Changes";
	}, 2000);

	// Settings are saved at this point; the reload just lets the page in front
	// of the user pick them up.
	await reloadActiveTab();
}

/* -------------------------------------------------------------------------
 * Import / export
 *
 * Rules travel as a JSON file so they can be backed up or moved to another
 * profile. An import only fills in the form; nothing is written to storage
 * until the user chooses Save Changes.
 * ---------------------------------------------------------------------- */

const EXPORT_APP_ID = "preferred-account-login";
const EXPORT_FORMAT_VERSION = 2;

function ruleCountLabel(count) {
	return count === 1 ? "1 rule" : `${count} rules`;
}

function holidayCountLabel(count) {
	return count === 1 ? "1 holiday date" : `${count} holiday dates`;
}

function setTransferStatus(message = "", isError = false) {
	const status = document.getElementById("transferStatus");
	if (!status) return;

	status.textContent = message;
	status.classList.toggle("error", Boolean(message) && isError);
	status.style.display = message ? "block" : "none";
}

function buildExportFileName() {
	const [date] = new Date().toISOString().split("T");
	return `preferred-account-login-rules-${date}.json`;
}

// Hands the user a file without needing the "downloads" permission — inside an
// extension popup an object URL on a synthetic anchor is enough.
function downloadJson(fileName, data) {
	const url = URL.createObjectURL(
		new Blob([`${JSON.stringify(data, null, 2)}\n`], {
			type: "application/json",
		})
	);

	const link = document.createElement("a");
	link.href = url;
	link.download = fileName;
	document.body.appendChild(link);
	link.click();
	link.remove();

	// Revoking straight away can cancel the download before it starts.
	setTimeout(() => URL.revokeObjectURL(url), 10000);
}

function handleExportClick() {
	setTransferStatus();

	// Export what is on screen rather than what is in storage, so the file
	// matches what the user is looking at. Going through the save-time
	// validation keeps every exported file importable.
	const rules = collectDomainEmailsFromForm();
	if (!rules) {
		setTransferStatus("Fix the highlighted errors before exporting.", true);
		return;
	}

	const count = Object.keys(rules).length;
	if (!count) {
		setTransferStatus("There are no rules to export yet.", true);
		return;
	}

	downloadJson(buildExportFileName(), {
		app: EXPORT_APP_ID,
		formatVersion: EXPORT_FORMAT_VERSION,
		exportedAt: new Date().toISOString(),
		rules,
		holidays: holidayDates,
	});
	setTransferStatus(
		`Exported ${ruleCountLabel(count)}` +
			(holidayDates.length
				? ` and ${holidayCountLabel(holidayDates.length)}`
				: "") +
			"."
	);
}

// Accepts a file this extension wrote, or a bare { domain: setting } map, so a
// hand-written file or one taken straight from storage still imports.
function extractRuleMap(parsed) {
	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
		return null;
	}

	for (const key of ["rules", "domainEmails"]) {
		const value = parsed[key];
		if (value && typeof value === "object" && !Array.isArray(value)) {
			return value;
		}
	}

	// A wrapper without a rule map holds nothing importable; anything else is
	// treated as the map itself.
	return "app" in parsed || "formatVersion" in parsed ? null : parsed;
}

// Normalizes an imported map against the same rules the form enforces. A row
// that cannot be resolved to a supported domain, or that carries an unusable
// email, is dropped rather than failing the whole import; an unusable time
// window is cleared and the rest of the row kept.
function normalizeImportedRules(ruleMap) {
	const rules = {};
	let skipped = 0;

	for (const [rawDomain, rawValue] of Object.entries(ruleMap)) {
		const domain = resolveDomainInput(rawDomain);
		if (!domain || rules[domain]) {
			skipped++;
			continue;
		}

		const setting = normalizeDomainSetting(rawValue);
		if (!validateEmail(setting.email)) {
			skipped++;
			continue;
		}

		if (
			setting.timeEnabled &&
			!isValidTimeRange(setting.startTime, setting.endTime)
		) {
			setting.timeEnabled = false;
			setting.startTime = "";
			setting.endTime = "";
		}

		rules[domain] = setting;
	}

	return { rules, skipped };
}

async function handleImportFile(event) {
	setTransferStatus();

	const [file] = event.target.files || [];
	// Clear the input so picking the same file again still fires a change.
	event.target.value = "";
	if (!file) return;

	let parsed;
	try {
		parsed = JSON.parse(await file.text());
	} catch {
		setTransferStatus("That file is not valid JSON.", true);
		return;
	}

	const ruleMap = extractRuleMap(parsed);
	if (!ruleMap) {
		setTransferStatus("That file does not contain any rules.", true);
		return;
	}

	const { rules, skipped } = normalizeImportedRules(ruleMap);
	const count = Object.keys(rules).length;
	if (!count) {
		setTransferStatus("No usable rules were found in that file.", true);
		return;
	}

	// Holiday dates ride along with the rules and are staged the same way a
	// hand-marked date is. A file written before format version 2 carries
	// none, and leaves the current dates alone.
	let importedHolidays = null;
	if (Array.isArray(parsed.holidays)) {
		holidayDates = pruneHolidays(parsed.holidays, getTodayKey());
		importedHolidays = holidayDates.length;
		stageHolidayEdit();
	}

	// Replace the list rather than merging it, so an exported file restores
	// exactly what it captured. Nothing reaches storage until Save Changes, so
	// closing the popup undoes this.
	populateDomainEmailList(document.getElementById("domainEmailList"), rules);
	enableSaveButton();
	setTransferStatus(
		`Loaded ${ruleCountLabel(count)}` +
			(importedHolidays === null
				? ""
				: ` and ${holidayCountLabel(importedHolidays)}`) +
			(skipped ? `, skipped ${skipped}` : "") +
			". Choose Save Changes to keep them."
	);
}

function validateAndMutateKey(key) {
	if (typeof key !== "string") throw new Error("Invalid key");
	return key;
}

async function getFromStorage(key) {
	let storageKey = validateAndMutateKey(key);
	return await chrome.storage.sync.get([storageKey]);
}

async function setStorage(key, value) {
	let storageKey = validateAndMutateKey(key);
	return await chrome.storage.sync.set({ [storageKey]: value });
}

function enableSaveButton() {
	let button = document.getElementById("saveButton");
	button.classList.remove("disabled");
	button.disabled = false;
}
