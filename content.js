(function () {
  const BTN_ID = "cc-editorial-finder-btn";
  const TEXT_DEFAULT = "📝 Find Editorial";
  const TEXT_SEARCHING = "🔍 Searching…";
  const TEXT_OPEN = "📝 Open Editorial";
  const TEXT_NO_EDITORIAL = "📝 No editorial found";

  let editorialPromise = null;
  let editorialResult = null;

  // Matches /problems/GMEDIAN and /problems/GMEDIAN?tab=statement alike,
  // since match patterns (and this regex) only care about the path.
  function getProblemCode() {
    const match = window.location.pathname.match(/\/problems\/([A-Za-z0-9_]+)/i);
    return match ? match[1] : null;
  }

  function makeButton() {
    const btn = document.createElement("button");
    btn.id = BTN_ID;
    btn.type = "button";
    btn.textContent = TEXT_DEFAULT;
    Object.assign(btn.style, {
      display: "inline-flex",
      alignItems: "center",
      zIndex: 999999,
      padding: "6px 12px",
      background: "#5b3a29",
      color: "#fff",
      border: "none",
      borderRadius: "6px",
      fontSize: "13px",
      fontWeight: "600",
      fontFamily: "system-ui, sans-serif",
      cursor: "pointer",
      boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
      transition: "opacity 0.15s ease",
      marginLeft: "8px",
      height: "36px",
    });
    btn.addEventListener("mouseenter", () => (btn.style.opacity = "0.85"));
    btn.addEventListener("mouseleave", () => (btn.style.opacity = "1"));
    return btn;
  }

  function setState(btn, text, disabled) {
    btn.textContent = text;
    btn.disabled = !!disabled;
  }

  function startFetch(code) {
    if (!editorialPromise) {
      editorialPromise = new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: "FIND_EDITORIAL", term: code }, (response) => {
          if (chrome.runtime.lastError) {
            resolve({ ok: false, error: chrome.runtime.lastError.message });
            return;
          }
          resolve(response);
        });
      });
    }
    return editorialPromise;
  }

  function resetEditorialState() {
    editorialPromise = null;
    editorialResult = null;
  }

  function handleClick(btn, code) {
    const alreadyResolved = editorialResult !== null;
    if (!alreadyResolved) {
      setState(btn, TEXT_SEARCHING, true);
    }

    startFetch(code).then((response) => {
      editorialResult = response;

      if (!response || !response.ok) {
        console.warn("[CodeChef Editorial Finder]", response && response.error);
        if (response && response.error === "No discussion threads found for this problem.") {
          setState(btn, TEXT_NO_EDITORIAL, false);
          setTimeout(() => setState(btn, TEXT_DEFAULT, false), 2000);
        } else {
          setState(btn, "Error — retry", false);
          setTimeout(() => setState(btn, TEXT_DEFAULT, false), 2000);
        }
        return;
      }

      setState(btn, alreadyResolved ? TEXT_DEFAULT : TEXT_DEFAULT, false);
      window.open(response.url, "_blank", "noopener");
    });
  }

  function findTabContainer() {
    const tablists = document.querySelectorAll('[role="tablist"]');
    for (const list of tablists) {
      if (list.querySelector('[aria-controls="vertical-tab-panel-3"], #vertical-tab-panel-3')) {
        return list;
      }
    }
    return null;
  }

  function tryInject() {
    if (document.getElementById(BTN_ID)) return;

    const code = getProblemCode();
    if (!code) return;

    const container = findTabContainer();
    if (!container) return;

    const btn = makeButton();
    btn.addEventListener("click", () => handleClick(btn, code));
    container.appendChild(btn);

    startFetch(code).then((response) => {
      editorialResult = response;

      const currentBtn = document.getElementById(BTN_ID);
      if (!currentBtn) return;

      if (response && response.ok) {
        setState(currentBtn, TEXT_OPEN, false);
      } else if (currentBtn.textContent === TEXT_SEARCHING) {
        setState(currentBtn, TEXT_DEFAULT, false);
      }
    });
  }

  function removeButton() {
    const existing = document.getElementById(BTN_ID);
    if (existing) existing.remove();
  }

  // Initial attempt
  tryInject();

  // CodeChef's problem page switches tabs (statement/submit/etc.) via
  // client-side routing without a full reload, and the problem code itself
  // can change without a full reload if the user navigates to another
  // problem from a "related problems" widget. Poll the path so the button
  // stays in sync. Also poll for the tab container, which React renders
  // asynchronously after document_end.
  let lastPath = window.location.pathname;
  setInterval(() => {
    if (window.location.pathname !== lastPath) {
      lastPath = window.location.pathname;
      removeButton();
      resetEditorialState();
    }
    tryInject();
  }, 500);
})();
