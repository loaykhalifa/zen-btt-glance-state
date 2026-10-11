// zen-btt-glance-state.uc.js
// Sends GLANCE or NORMAL to BetterTouchTool variable "zen_tab_type".
(function () {
    "use strict";

    const SCRIPT_NAME = "zenBTTGlanceState";
    const VARIABLE_NAME = "zen_tab_type";
    const DEBOUNCE_MS = 40;

    const previous = window[SCRIPT_NAME];
    if (previous && typeof previous.destroy === "function") {
        previous.destroy();
    }

    let observer = null;
    let timer = null;
    let retryTimer = null;
    let lastState = null;
    let destroyed = false;
    const listeners = [];

    function addListener(target, type, listener, options) {
        target.addEventListener(type, listener, options);
        listeners.push({ target, type, listener, options });
    }

    function getState() {
        const selectedTab = window.gBrowser?.selectedTab;
        const selectedGlance = document.querySelector(
            'tab[zen-glance-tab][selected="true"], tab[zen-glance-tab][selected]'
        );

        return (
            selectedTab?.hasAttribute?.("zen-glance-tab") ||
            Boolean(selectedGlance)
        ) ? "GLANCE" : "NORMAL";
    }

    async function notifyBTT(force = false) {
        if (destroyed) return;

        const state = getState();
        if (!force && state === lastState) return;

        const url =
            "btt://set_string_variable/?" +
            "variableName=" + encodeURIComponent(VARIABLE_NAME) +
            "&to=" + encodeURIComponent(state);

        try {
            const { Subprocess } = ChromeUtils.importESModule(
                "resource://gre/modules/Subprocess.sys.mjs"
            );

            await Subprocess.call({
                command: "/usr/bin/open",
                arguments: ["-g", url]
            });

            lastState = state;
            console.log(
                `[${SCRIPT_NAME}] BetterTouchTool state: ${state}`
            );
        } catch (error) {
            console.error(
                `[${SCRIPT_NAME}] Could not notify BetterTouchTool:`,
                error
            );
        }
    }

    function scheduleUpdate(force = false) {
        if (timer !== null) {
            window.clearTimeout(timer);
        }

        timer = window.setTimeout(() => {
            timer = null;
            notifyBTT(force);
        }, DEBOUNCE_MS);
    }

    function start() {
        if (destroyed) return;

        if (!window.gBrowser || !document.documentElement) {
            retryTimer = window.setTimeout(start, 250);
            return;
        }

        observer = new MutationObserver(() => scheduleUpdate());

        observer.observe(document.documentElement, {
            subtree: true,
            childList: true,
            attributes: true,
            attributeFilter: [
                "selected",
                "zen-glance-tab"
            ]
        });

        addListener(
            window.gBrowser.tabContainer,
            "TabSelect",
            () => scheduleUpdate(),
            true
        );
        addListener(window, "focus", () => scheduleUpdate(true), true);
        addListener(window, "unload", destroy, { once: true });

        scheduleUpdate(true);
        console.log(
            `[${SCRIPT_NAME}] Loaded — syncing Zen Glance state to BTT.`
        );
    }

    function destroy() {
        destroyed = true;

        if (observer) {
            observer.disconnect();
            observer = null;
        }

        if (timer !== null) {
            window.clearTimeout(timer);
            timer = null;
        }

        if (retryTimer !== null) {
            window.clearTimeout(retryTimer);
            retryTimer = null;
        }

        for (const { target, type, listener, options } of listeners.splice(0)) {
            try {
                target.removeEventListener(type, listener, options);
            } catch (_) {}
        }

        if (window[SCRIPT_NAME] === api) {
            delete window[SCRIPT_NAME];
        }
    }

    const api = Object.freeze({
        getState,
        notifyBTT,
        destroy
    });

    window[SCRIPT_NAME] = api;
    start();
})();
