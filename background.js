// Runs in the extension's background context, so the fetch to
// discuss.codechef.com is NOT subject to the page's CORS policy
// (only to whatever discuss.codechef.com itself allows for direct requests).

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== "FIND_EDITORIAL") return false;

  const term = message.term;
  const url = `https://discuss.codechef.com/search/query?term=${encodeURIComponent(term)}`;

  fetch(url, { headers: { Accept: "application/json" } })
    .then((res) => {
      if (!res.ok) throw new Error(`discuss.codechef.com returned ${res.status}`);
      return res.json();
    })
    .then((data) => {
      const topics = data && data.topics;

      if (!topics || topics.length === 0) {
        sendResponse({ ok: false, error: "No discussion threads found for this problem." });
        return;
      }

      const topic = topics[0];
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
