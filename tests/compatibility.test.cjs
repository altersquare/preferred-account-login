const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = (name) => fs.readFileSync(path.join(root, "src", name), "utf8");

function environment(namespace, settings = {}) {
	const data = { isEnabled: true, ...settings };
	const flags = new Map();
	let reloads = 0;
	const api = {
		storage: {
			sync: {
				async get(keys) {
					return Object.fromEntries(
						keys.map((key) => [key, data[key]])
					);
				},
				async set(values) {
					Object.assign(data, values);
				},
			},
		},
		tabs: {
			async reload() {
				reloads++;
			},
		},
	};
	const context = vm.createContext({
		[namespace]: api,
		URL,
		URLSearchParams,
		console: {
			log() {},
			warn() {},
			error(error) {
				throw error;
			},
		},
		document: { addEventListener() {} },
		window: {
			location: {
				href: "https://mail.google.com/mail/",
				hostname: "mail.google.com",
				protocol: "https:",
			},
		},
		sessionStorage: {
			getItem: (key) => flags.get(key) ?? null,
			setItem: (key, value) => flags.set(key, value),
			removeItem: (key) => flags.delete(key),
		},
	});
	if (namespace === "browser") {
		// Firefox also exposes chrome, but its callback API must not be used.
		context.chrome = new Proxy(
			{},
			{
				get() {
					throw new Error("Used chrome in Firefox");
				},
			}
		);
	}
	vm.runInContext(source("browser-api.js"), context);
	vm.runInContext(source("rules.js"), context);
	return { context, data, flags, reloads: () => reloads };
}

for (const namespace of ["chrome", "browser"]) {
	test(`${namespace}: content redirects using a stored preferred account`, async () => {
		const { context, flags } = environment(namespace, {
			domainEmails: { "mail.google.com": "work@gmail.com" },
		});
		vm.runInContext(
			source("content.js").replace(
				"(async () =>",
				"globalThis.contentReady = (async () =>"
			),
			context
		);
		await context.contentReady;
		assert.equal(
			new URL(context.window.location.href).searchParams.get("authuser"),
			"work@gmail.com"
		);
		assert.equal(flags.get("pgl_redirect_flag"), "true");
		// A second page load must consume the loop guard without redirecting.
		context.window.location.href = "https://mail.google.com/mail/";
		await context.setAuthUser("work@gmail.com");
		assert.equal(
			context.window.location.href,
			"https://mail.google.com/mail/"
		);
	});

	test(`${namespace}: popup persists settings and reloads through the same API`, async () => {
		const { context, data, reloads } = environment(namespace);
		vm.runInContext(source("popup.js"), context);
		await context.setStorage("holidays", ["2026-12-25"]);
		assert.equal(
			(await context.getFromStorage("holidays")).holidays[0],
			"2026-12-25"
		);
		assert.equal(data.holidays[0], "2026-12-25");
		await context.reloadActiveTab();
		assert.equal(reloads(), 1);
		await assert.rejects(context.setStorage(null, true), /Invalid key/);
	});

	test(`${namespace}: disabling or pausing prevents redirects`, async () => {
		for (const overrides of [
			{ isEnabled: false },
			{ pausedUntil: Date.now() + 60000 },
		]) {
			const { context } = environment(namespace, {
				domainEmails: { "mail.google.com": "work@gmail.com" },
				...overrides,
			});
			vm.runInContext(
				source("content.js").replace(
					"(async () =>",
					"globalThis.contentReady = (async () =>"
				),
				context
			);
			await context.contentReady;
			assert.equal(
				context.window.location.href,
				"https://mail.google.com/mail/"
			);
		}
	});
}

test("Shared manifest has a stable Firefox storage ID and loads the API adapter first", () => {
	const manifest = JSON.parse(
		fs.readFileSync(path.join(root, "manifest.json"))
	);
	const settings = manifest.browser_specific_settings;
	assert.equal(settings.gecko.id, "preferred-account-login@altersquare.io");
	assert.equal(settings.gecko.strict_min_version, "140.0");
	for (const entry of manifest.content_scripts) {
		assert.equal(entry.js[0], "src/browser-api.js");
		for (const file of entry.js)
			assert.ok(fs.existsSync(path.join(root, file)));
	}
	const html = source("popup.html");
	assert.ok(
		html.indexOf('src="browser-api.js"') < html.indexOf('src="popup.js"')
	);
});

test("Firefox opens import in a persistent tab instead of the popup file picker", async () => {
	const { context } = environment("browser");
	let openedUrl;
	context.browser.runtime = {
		getBrowserInfo() {},
		getURL: (file) => `moz-extension://test/${file}`,
	};
	context.browser.tabs.create = async ({ url }) => {
		openedUrl = url;
	};
	context.document.getElementById = () => {
		throw new Error("Popup picker must not open");
	};
	vm.runInContext(source("popup.js"), context);
	await context.handleImportClick();
	assert.equal(openedUrl, "moz-extension://test/src/popup.html?import=1");
});

for (const namespace of ["chrome", "browser"]) {
	test(`${namespace}: import page opens its own picker without creating another tab`, async () => {
		const { context } = environment(namespace);
		context.window.location.search = "?import=1";
		context[namespace].runtime = { getBrowserInfo() {} };
		let clicks = 0;
		context.document.getElementById = () => ({
			click() {
				clicks++;
			},
		});
		vm.runInContext(source("popup.js"), context);
		await context.handleImportClick();
		assert.equal(clicks, 1);
	});
}

test("Chrome popup continues to open its file picker directly", async () => {
	const { context } = environment("chrome");
	context.chrome.runtime = {};
	let clicks = 0;
	context.document.getElementById = () => ({
		click() {
			clicks++;
		},
	});
	vm.runInContext(source("popup.js"), context);
	await context.handleImportClick();
	assert.equal(clicks, 1);
});
