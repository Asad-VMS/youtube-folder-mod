// youtube-redirect-to-pinned.uc.js
// Redirects any new tab that navigates to YouTube into your existing
// pinned YouTube folder, instead of opening a separate tab.
// Loaded as a Sine mod via theme.json.

(function () {
  const TAG = "[YTFolderMod]";
  const YOUTUBE_HOSTS = new Set([
    "www.youtube.com",
    "youtube.com",
    "m.youtube.com",
    "youtu.be",
  ]);

  console.log(TAG, "script loaded");

  function findPinnedYoutubeTab(excludeTab) {
    for (const tab of gBrowser.tabs) {
      if (tab === excludeTab) continue;
      if (!tab.pinned) continue;
      try {
        const host = tab.linkedBrowser?.currentURI?.host;
        console.log(TAG, "checking pinned tab host:", host);
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
    const folder = pinnedTab.group;
    console.log(TAG, "pinnedTab.group =", folder, "tagName:", folder?.tagName);

    if (!newTab.pinned) {
      gBrowser.pinTab(newTab);
      console.log(TAG, "pinned the new tab");
    }

    if (folder && typeof folder.addTabs === "function") {
      console.log(TAG, "using folder.addTabs()");
      folder.addTabs([newTab]);
    } else if (folder && typeof gBrowser.moveTabToGroup === "function") {
      console.log(TAG, "using gBrowser.moveTabToGroup()");
      gBrowser.moveTabToGroup(newTab, folder);
    } else if (folder) {
      console.log(TAG, "using DOM insertBefore fallback");
      try {
        folder.insertBefore(newTab, pinnedTab.nextSibling);
      } catch (e) {
        console.error(TAG, "DOM fallback failed", e);
      }
    } else {
      console.warn(TAG, "no folder/group found on pinned tab — cannot nest");
    }

    try {
      gBrowser.moveTabTo(newTab, pinnedTab._tPos + 1);
    } catch (e) {
      console.warn(TAG, "moveTabTo failed", e);
    }
    gBrowser.selectedTab = newTab;
  }

  function handleTabOpen(event) {
    const newTab = event.target;
    console.log(TAG, "TabOpen fired, pinned already?", newTab.pinned);

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
        console.log(TAG, "new tab navigated to host:", host);

        if (YOUTUBE_HOSTS.has(host)) {
          const pinnedTab = findPinnedYoutubeTab(newTab);
          console.log(TAG, "found pinned YouTube tab?", !!pinnedTab);
          if (pinnedTab) {
            try {
              moveTabIntoFolder(newTab, pinnedTab);
              console.log(TAG, "moveTabIntoFolder completed");
            } catch (e) {
              console.error(TAG, "failed to move tab into folder", e);
            }
          } else {
            console.warn(TAG, "no pinned YouTube tab found in this workspace");
          }
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
      console.error(TAG, "could not attach listener", e);
    }

    setTimeout(() => {
      try {
        browser.removeProgressListener(listener);
      } catch (e) {}
    }, 15000);
  }

  if (typeof gBrowser !== "undefined" && gBrowser.tabContainer) {
    gBrowser.tabContainer.addEventListener("TabOpen", handleTabOpen);
    console.log(TAG, "listener attached immediately");
  } else {
    window.addEventListener(
      "load",
      () => {
        gBrowser.tabContainer.addEventListener("TabOpen", handleTabOpen);
        console.log(TAG, "listener attached after load");
      },
      { once: true }
    );
  }
})();
