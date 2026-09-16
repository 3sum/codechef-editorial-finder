// Runs in the extension's background context, so the fetch to
// discuss.codechef.com is NOT subject to the page's CORS policy
// (only to whatever discuss.codechef.com itself allows for direct requests).

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findEditorialTopic(topics, term) {
  const termLower = term.toLowerCase();
  const termRegex = new RegExp(`\\b${escapeRegex(termLower)}\\b`, "i");
  const editorialRegex = /\beditorial\b/i;

  // Step 1: Check slugs for {term}-editorial (e.g. "exptree-editorial")
  for (const topic of topics) {
    if (topic.slug && topic.slug.includes(termLower + "-editorial")) {
      return topic;
    }
  }

  // Step 2: Check titles for BOTH {term} and "editorial" as separate words
  // (e.g. "EXPTREE Editorial" but NOT "Exptrees Editorial")
  const bothMatches = [];
  for (let i = 0; i < topics.length; i++) {
    const topic = topics[i];
    if (!topic.title) continue;
    const titleLower = topic.title.toLowerCase();
    if (termRegex.test(titleLower) && editorialRegex.test(titleLower)) {
      bothMatches.push({ topic, len: topic.title.length, index: i });
    }
  }
  if (bothMatches.length > 0) {
    bothMatches.sort((a, b) => a.len - b.len || a.index - b.index);
    return bothMatches[0].topic;
  }

  // Step 3: Check titles for {term} as a separate word (any title)
  const termMatches = [];
  for (let i = 0; i < topics.length; i++) {
    const topic = topics[i];
    if (!topic.title) continue;
    const titleLower = topic.title.toLowerCase();
    if (termRegex.test(titleLower)) {
      termMatches.push({ topic, len: topic.title.length, index: i });
    }
  }
  if (termMatches.length > 0) {
    termMatches.sort((a, b) => a.len - b.len || a.index - b.index);
    return termMatches[0].topic;
  }

  // Step 4: No match
  return null;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== "FIND_EDITORIAL") return false;

  const term = message.term;
  const termEditorial = `${term} - Editorial`;

  const fetchTopics = (q) =>
    fetch(
      `https://discuss.codechef.com/search/query?term=${encodeURIComponent(q)}`,
      { headers: { Accept: "application/json" } }
    ).then((res) => {
      if (!res.ok) throw new Error(`discuss.codechef.com returned ${res.status}`);
      return res.json();
    }).then((data) => (data && data.topics) || []);

  // Fire both queries in parallel; collect whichever succeed.
  Promise.allSettled([fetchTopics(term), fetchTopics(termEditorial)])
    .then(([r1, r2]) => {
      // Merge results, preserving order (code-query first, then code-editorial-query),
      // deduplicating by topic id.
      const seen = new Set();
      const topics = [];
      for (const result of [r1, r2]) {
        if (result.status === "fulfilled") {
          for (const topic of result.value) {
            if (!seen.has(topic.id)) {
              seen.add(topic.id);
              topics.push(topic);
            }
          }
        }
      }

      if (topics.length === 0) {
        sendResponse({ ok: false, error: "No discussion threads found for this problem." });
        return;
      }

      const topic = findEditorialTopic(topics, term);
      if (!topic) {
        sendResponse({ ok: false, error: "No editorial found for this problem." });
        return;
      }

      if (!topic.slug || topic.id === undefined || topic.id === null) {
        sendResponse({ ok: false, error: "Top result is missing a slug/id." });
        return;
      }

      const editorialUrl = `https://discuss.codechef.com/t/${topic.slug}/${topic.id}`;
      sendResponse({ ok: true, url: editorialUrl, title: topic.fancy_title || topic.title });
    })
    .catch((err) => {
      sendResponse({ ok: false, error: err.message });
    });

  // Returning true keeps the message channel open for the async sendResponse above.
  return true;
});
