(() => {
  const nativeFetch = window.fetch.bind(window);
  const questionUrl = new URL("../data/questions/completed_questions.json", window.location.href).href;
  const supabaseProbeUrl = "https://yygezzpowsvpzarqdtls.supabase.co/rest/v1/rpc/get_question_stats";
  const supabasePublishableKey = "sb_publishable_rQmX7MCx_8W3nz-xWXQBpA_CHzdRQSk";

  const questionCount = document.querySelector("#questionCount");
  const fieldFilters = document.querySelector("#fieldFilters");
  const startButton = document.querySelector("#startButton");
  const increaseSetSizeButton = document.querySelector("#increaseSetSizeButton");
  const decreaseSetSizeButton = document.querySelector("#decreaseSetSizeButton");

  if (questionCount) {
    questionCount.textContent = "読込中";
  }

  if (fieldFilters) {
    const loadingNote = document.createElement("span");
    loadingNote.textContent = "問題データを読み込んでいます…";
    loadingNote.style.color = "var(--muted)";
    loadingNote.style.fontSize = "0.9rem";
    fieldFilters.replaceChildren(loadingNote);
  }

  if (startButton) {
    startButton.disabled = true;
    startButton.textContent = "問題を読み込み中…";
  }
  if (increaseSetSizeButton) {
    increaseSetSizeButton.disabled = true;
  }
  if (decreaseSetSizeButton) {
    decreaseSetSizeButton.disabled = true;
  }

  // Start both network requests before app.js runs. app.js reuses these responses below.
  const questionRequest = nativeFetch(questionUrl, { cache: "default" });
  const apiProbeRequest = nativeFetch(supabaseProbeUrl, {
    method: "POST",
    headers: {
      apikey: supabasePublishableKey,
      Authorization: `Bearer ${supabasePublishableKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_ids: [] }),
  });

  window.fetch = (input, init = {}) => {
    const url = getRequestUrl(input);

    if (url === questionUrl) {
      return reuseOrRetry(questionRequest, input, init);
    }

    if (url === supabaseProbeUrl && isApiAvailabilityProbe(init)) {
      return reuseOrRetry(apiProbeRequest, input, init);
    }

    return nativeFetch(input, init);
  };

  function getRequestUrl(input) {
    const value = input instanceof Request ? input.url : String(input);
    return new URL(value, window.location.href).href;
  }

  function isApiAvailabilityProbe(init) {
    if (String(init.method || "GET").toUpperCase() !== "POST") {
      return false;
    }

    try {
      const body = typeof init.body === "string" ? JSON.parse(init.body) : null;
      return Array.isArray(body?.p_ids) && body.p_ids.length === 0;
    } catch {
      return false;
    }
  }

  function reuseOrRetry(request, input, init) {
    return request
      .then((response) => (response.ok ? response.clone() : nativeFetch(input, init)))
      .catch(() => nativeFetch(input, init));
  }
})();
