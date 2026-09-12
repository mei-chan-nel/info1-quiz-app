(() => {
  "use strict";

  const questionUrl = new URL("../data/questions/completed_questions.json", window.location.href).href;
  let cachedQuestions = null;
  let pendingRequest = null;

  const load = () => {
    if (cachedQuestions) {
      return Promise.resolve(cachedQuestions);
    }
    return requestLatestQuestions();
  };

  const refresh = () => requestLatestQuestions();

  const requestLatestQuestions = () => {
    if (pendingRequest) {
      return pendingRequest;
    }

    // Allow the browser to reuse the body after validating it with the server.
    pendingRequest = fetch(questionUrl, { cache: "no-cache" })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.json();
      })
      .then((questions) => {
        if (!Array.isArray(questions)) {
          throw new TypeError("問題データの形式が正しくありません。");
        }
        cachedQuestions = questions;
        return cachedQuestions;
      })
      .finally(() => {
        pendingRequest = null;
      });
    return pendingRequest;
  };

  window.StudyAtlasQuestionData = Object.freeze({
    load,
    refresh,
    url: questionUrl,
  });
})();
