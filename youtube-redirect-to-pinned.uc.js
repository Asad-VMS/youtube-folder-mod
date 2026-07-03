// youtube-redirect-to-pinned.uc.mjs
// Redirects any new tab that navigates to YouTube into your existing
// pinned YouTube tab, instead of opening a separate tab.
//
// Requires fx-autoconfig (already set up if you're using Sine).
// Install: drop this file into your profile's chrome/JS folder,
// then import it from your import.uc.mjs (or JS/import.mjs) file:
//   import "./youtube-redirect-to-pinned.uc.mjs";
// Restart Zen afterwards.

(function () {
  const YOUTUBE_HOSTS = new Set([
    "www.youtube.com",
    "youtube.com",
    "m.youtube.com",
    "youtu.be",
  ]);

  function findPinnedYoutubeTab(excludeTab) {
    for (const tab of gBrowser.tabs) {
      if (tab === excludeTab) continue;
      if (!tab.pinned) continue;
      try {
        const host = tab.linkedBrowser?.currentURI?.host;
        if (host && YOUTUBE_HOSTS.has(host)) {
          return tab;
        }
      } catch (e) {
        // ignore tabs without a resolvable URI (e.g. blank pinned tabs)
      }
    }
    return null;
  }

  function moveTabIntoFolder(newTab, pinnedTab) {
    // The folder is the enclosing tab group of the pinned "home" tab.
    const folder = pinnedTab.group;

    if (!newTab.pinned) {
      gBrowser.pinTab(newTab);
    }

    if (folder && typeof folder.addTabs === "function") {
      // Native Firefox/Zen tab-group API
      folder.addTabs([newTab]);
    } else if (folder && typeof gBrowser.moveTabToGroup === "function") {
      gBrowser.moveTabToGroup(newTab, folder);
    } else if (folder) {
      // Fallback: reparent the tab's DOM node right after the pinned tab
      try {
        folder.insertBefore(newTab, pinnedTab.nextSibling);
      } catch (e) {
        console.error("youtube-redirect-to-pinned: DOM fallback failed", e);
      }
    }

    // Put the new tab right after the pinned home tab, then select it
    try {
      gBrowser.moveTabTo(newTab, pinnedTab._tPos + 1);
    } catch (e) {}
    gBrowser.selectedTab = newTab;
  }

  function handleTabOpen(event) {
    const newTab = event.target;

    // Don't touch tabs that are already pinned/folder tabs themselves
    if (newTab.pinned) return;

    const browser = newTab.linkedBrowser;
    if (!browser) return;

    const listener = {
      QueryInterface: ChromeUtils.generateQI([
        "nsIWebProgressListener",
        "nsISupportsWeakReference",
      ]),
      onLocationChange(aBrowser, aWebProgress, aRequest, aLocation) {
        if (aBrowser !== browser) return;
        if (!aWebProgress.isTopLevel) return;

        let host;
        try {
          host = aLocation.host;
        } catch (e) {
          return;
        }

        if (YOUTUBE_HOSTS.has(host)) {
          const pinnedTab = findPinnedYoutubeTab(newTab);
          if (pinnedTab) {
            try {
              moveTabIntoFolder(newTab, pinnedTab);
            } catch (e) {
              console.error("youtube-redirect-to-pinned: failed to move tab into folder", e);
            }
          }
          // Stop listening either way once we've resolved a YouTube URL
          try {
            browser.removeProgressListener(listener);
          } catch (e) {}
        }
      },
    };

    try {
      browser.addProgressListener(
        listener,
        Ci.nsIWebProgress.NOTIFY_LOCATION
      );
    } catch (e) {
      console.error("youtube-redirect-to-pinned: could not attach listener", e);
    }

    // Safety net: detach listener after 15s so we don't leak listeners
    // on tabs that never end up navigating to YouTube.
    setTimeout(() => {
      try {
        browser.removeProgressListener(listener);
      } catch (e) {}
    }, 15000);
  }

  if (typeof gBrowser !== "undefined" && gBrowser.tabContainer) {
    gBrowser.tabContainer.addEventListener("TabOpen", handleTabOpen);
  } else {
    window.addEventListener(
      "load",
      () => {
        gBrowser.tabContainer.addEventListener("TabOpen", handleTabOpen);
      },
      { once: true }
    );
  }
})();
