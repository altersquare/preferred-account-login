// Firefox's browser namespace returns promises. Keep Chrome's existing
// promise-based API as the fallback for Chromium versions without it.
/* exported extensionApi */
const extensionApi = typeof browser !== "undefined" ? browser : chrome;
