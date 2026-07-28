(() => {
  "use strict";

  const questionUrl = new URL("../data/questions/completed_questions.json", window.location.href).href;
  let cachedQuestions = null;
  let pendingRequest = null;

  const load = () => {
    if (cachedQuestions) {
      return Promise.resolve(cachedQuestions);
    }
    if (pendingRequest) {
      return pendingRequest;
    }

    pendingRequest = fetch(questionUrl, { cache: "no-store" })
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
      .catch((error) => {
        pendingRequest = null;
        throw error;
      });
    return pendingRequest;
  };

  window.StudyAtlasQuestionData = Object.freeze({
    load,
    url: questionUrl,
  });
})();
