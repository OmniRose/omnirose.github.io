// Keep a page's state (the "#..." part of its link) in this browser's local
// storage too, so following a link away and coming back doesn't lose it.
// Nothing is sent anywhere. Storage can be blocked or missing (private
// windows, strict settings); then this quietly does nothing.

export function remember(key, hash) {
  try {
    if (hash) localStorage.setItem(key, hash);
    else localStorage.removeItem(key);
  } catch {
    // Not available; the link still holds everything.
  }
}

export function recall(key) {
  try {
    return localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

// Arriving with no "#..." in the link: bring back the last state, if any,
// and show `notice`. Its [data-forget] button clears it and starts afresh.
export function restore(key, notice) {
  const saved = location.hash ? "" : recall(key);
  if (saved) {
    history.replaceState(null, "", saved);
    notice.hidden = false;
  }
  notice.querySelector("[data-forget]").addEventListener("click", () => {
    remember(key, "");
    location.replace(location.pathname);
  });
}
