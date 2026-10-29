# Local desktop Firefox support

The user narrowed the initial desktop-and-Android request to desktop Firefox on
their local machine, with no publishing workflow.

Use one shared Manifest V3 extension for Chrome and Firefox. A small API adapter
selects Firefox's promise-based `browser` namespace or Chrome's existing API.
Load it before the content script and popup. A stable `gecko.id` enables Firefox
sync storage, including during temporary installation. Firefox 140 or later is
the supported desktop baseline. Chrome ignores `browser_specific_settings`.

Load the repository's manifest through `about:debugging` without packaging,
signing, or a public store listing. Temporary add-ons must be loaded again after
Firefox restarts. Export/import backs up rules and transfers them from Chrome.

No Android-specific UI, generated manifests, packaging scripts, or store
submission metadata are required for this scope. Keep the existing rule engine,
desktop UI, host permissions, and storage format.

Verify the API adapter, persistence, redirects, disabled/paused behavior, and
manifest script ordering with focused tests. Run lint and load the actual
extension into an isolated Firefox profile when available.
