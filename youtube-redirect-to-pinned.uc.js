// youtube-redirect-to-pinned.uc.js
// Automatically moves any newly opened YouTube tab into the existing
// "YouTube" Zen folder.
//
// Zen Browser 1.21.5b
// Sine Mod

(function () {
    const TAG = "[YTFolderMod]";

    const YOUTUBE_HOSTS = new Set([
        "youtube.com",
        "www.youtube.com",
        "m.youtube.com",
        "youtu.be",
    ]);

    console.log(TAG, "Loaded.");

    function findYoutubeFolder() {
        const folders =
            gBrowser.tabContainer.querySelectorAll("zen-folder");

        console.log(TAG, "Folders found:", folders.length);

        for (const folder of folders) {
            const label =
                folder.label ??
                folder.getAttribute("label") ??
                "";

            console.log(TAG, "Folder:", label);

            if (label.toLowerCase() === "youtube") {
                console.log(TAG, "Matched YouTube folder.");
                return folder;
            }
        }

        console.warn(TAG, "YouTube folder not found.");
        return null;
    }

    function moveTabIntoYoutubeFolder(tab) {
        const folder = findYoutubeFolder();

        if (!folder)
            return;

        try {
            if (!tab.pinned) {
                gBrowser.pinTab(tab);
                console.log(TAG, "Pinned tab.");
            }

            if (typeof folder.addTabs === "function") {
                console.log(TAG, "Calling folder.addTabs()");
                folder.addTabs([tab]);
            } else {
                console.error(TAG, "folder.addTabs does not exist!", folder);
            }

            gBrowser.selectedTab = tab;
        } catch (e) {
            console.error(TAG, "Failed moving tab:", e);
        }
    }

    function watchTab(tab) {
        const browser = tab.linkedBrowser;
        if (!browser)
            return;

        const listener = {
            QueryInterface: ChromeUtils.generateQI([
                "nsIWebProgressListener",
                "nsISupportsWeakReference",
            ]),

            onLocationChange(aBrowser, webProgress, request, location) {
                if (aBrowser !== browser)
                    return;

                if (!webProgress.isTopLevel)
                    return;

                let host = "";

                try {
                    host = location.host;
                } catch (_) {
                    return;
                }

                console.log(TAG, "Visited:", host);

                if (YOUTUBE_HOSTS.has(host)) {
                    console.log(TAG, "YouTube detected.");

                    moveTabIntoYoutubeFolder(tab);

                    try {
                        browser.removeProgressListener(listener);
                    } catch (_) {}
                }
            },
        };

        browser.addProgressListener(
            listener,
            Ci.nsIWebProgress.NOTIFY_LOCATION
        );

        setTimeout(() => {
            try {
                browser.removeProgressListener(listener);
            } catch (_) {}
        }, 15000);
    }

    function onTabOpen(event) {
        const tab = event.target;

        if (tab.pinned)
            return;

        console.log(TAG, "New tab opened.");

        watchTab(tab);
    }

    function init() {
        if (!gBrowser || !gBrowser.tabContainer) {
            console.error(TAG, "gBrowser not ready.");
            return;
        }

        gBrowser.tabContainer.addEventListener(
            "TabOpen",
            onTabOpen
        );

        console.log(TAG, "Listening for new tabs.");
    }

    if (document.readyState === "complete") {
        init();
    } else {
        window.addEventListener("load", init, {
            once: true,
        });
    }
})();
