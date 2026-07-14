(() => {
  "use strict";

  const STORAGE_KEY = "info1LearningRecord:v1";
  const LEGACY_STORAGE_KEY = "info1QuizStats:v4";
  const RECORD_VERSION = 1;
  const JAPAN_TIME_ZONE = "Asia/Tokyo";
  const dateFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: JAPAN_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  let data = loadData();

  window.Info1LearningRecord = Object.freeze({
    recordAnswer,
    getQuestion,
    getHistory,
    isChecked,
    toggleChecked,
    setChecked,
    hasThreeCorrectInARow,
    summarize,
    clear,
    getStreak,
    getStorageKey: () => STORAGE_KEY,
  });

  function emptyData() {
    return { v: RECORD_VERSION, q: {}, d: [] };
  }

  function loadData() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (parsed && parsed.v === RECORD_VERSION && parsed.q && typeof parsed.q === "object") {
        parsed.d = Array.isArray(parsed.d) ? [...new Set(parsed.d.filter(isDateKey))].sort() : [];
        for (const [questionId, record] of Object.entries(parsed.q)) {
          parsed.q[questionId] = normalizeRecord(record);
        }
        return parsed;
      }
    } catch (error) {
      console.warn("学習記録を読み込めませんでした。", error);
    }
    return migrateLegacyData();
  }

  function migrateLegacyData() {
    const migrated = emptyData();
    try {
      const legacy = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) || "null");
      if (legacy && typeof legacy === "object") {
        for (const [questionId, item] of Object.entries(legacy)) {
          const attempts = toCount(item?.attempts);
          const correct = Math.min(toCount(item?.correct), attempts);
          if (attempts > 0) {
            migrated.q[questionId] = [attempts, correct, -1, 0, "", 0];
          }
        }
        if (persist(migrated)) {
          localStorage.removeItem(LEGACY_STORAGE_KEY);
        }
      }
    } catch (error) {
      console.warn("以前の学習記録を移行できませんでした。", error);
    }
    return migrated;
  }

  function normalizeRecord(record) {
    if (!Array.isArray(record)) {
      return [0, 0, -1, 0, "", 0];
    }
    const attempts = toCount(record[0]);
    const correct = Math.min(toCount(record[1]), attempts);
    const last = record[2] === 1 ? 1 : record[2] === 0 ? 0 : -1;
    const answeredAt = Number.isFinite(Number(record[3])) ? Math.max(0, Number(record[3])) : 0;
    const history = String(record[4] || "").replace(/[^01]/g, "");
    const checked = record[5] === 1 ? 1 : 0;
    return [attempts, correct, last, answeredAt, history, checked];
  }

  function recordAnswer(questionId, isCorrect, answeredAt = Date.now()) {
    const id = String(questionId || "").trim();
    if (!id) {
      return null;
    }
    const record = getMutableRecord(id);
    const result = isCorrect ? 1 : 0;
    record[0] += 1;
    record[1] += result;
    record[2] = result;
    record[3] = Number(answeredAt) || Date.now();
    record[4] += String(result);
    addStudyDay(toJapanDateKey(record[3]));
    persist(data);
    return toPublicRecord(record);
  }

  function getQuestion(questionId) {
    const record = data.q[String(questionId || "")];
    return record ? toPublicRecord(record) : emptyPublicRecord();
  }

  function getHistory(questionId) {
    return String(data.q[String(questionId || "")]?.[4] || "");
  }

  function isChecked(questionId) {
    return data.q[String(questionId || "")]?.[5] === 1;
  }

  function toggleChecked(questionId) {
    const id = String(questionId || "").trim();
    if (!id) {
      return false;
    }
    return setChecked(id, !isChecked(id));
  }

  function setChecked(questionId, checked) {
    const id = String(questionId || "").trim();
    if (!id) {
      return false;
    }
    const record = getMutableRecord(id);
    record[5] = checked ? 1 : 0;
    removeEmptyRecord(id);
    persist(data);
    return checked;
  }

  function hasThreeCorrectInARow(questionId) {
    return getHistory(questionId).endsWith("111");
  }

  function summarize(questions, fieldDefinitions) {
    const questionList = Array.isArray(questions) ? questions : [];
    const questionById = new Map(questionList.map((question) => [String(question.id), question]));
    const fields = Object.fromEntries(
      (fieldDefinitions || []).map((field) => [field.id, { id: field.id, label: field.label, attempts: 0, correct: 0 }]),
    );
    let attempts = 0;
    let correct = 0;
    let solved = 0;
    const wrongQuestionIds = [];
    const checkedQuestionIds = [];

    for (const [questionId, rawRecord] of Object.entries(data.q)) {
      const record = normalizeRecord(rawRecord);
      const question = questionById.get(questionId);
      if (record[5] === 1 && question) {
        checkedQuestionIds.push(questionId);
      }
      if (record[0] <= 0) {
        continue;
      }
      attempts += record[0];
      correct += record[1];
      if (question) {
        solved += 1;
      }
      if (record[2] === 0 && question) {
        wrongQuestionIds.push(questionId);
      }
      const fieldId = question?.field_ids?.[0] || question?.fields?.[0];
      if (fieldId && fields[fieldId]) {
        fields[fieldId].attempts += record[0];
        fields[fieldId].correct += record[1];
      }
    }

    const byNewest = (left, right) => (data.q[right]?.[3] || 0) - (data.q[left]?.[3] || 0);
    wrongQuestionIds.sort(byNewest);
    checkedQuestionIds.sort(byNewest);
    return {
      attempts,
      correct,
      rate: percentage(correct, attempts),
      solved,
      totalQuestions: questionList.length,
      wrongQuestionIds,
      checkedQuestionIds,
      fields: Object.values(fields).map((field) => ({
        ...field,
        rate: percentage(field.correct, field.attempts),
      })),
      streak: getStreak(),
    };
  }

  function clear() {
    data = emptyData();
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
      return true;
    } catch (error) {
      console.error("学習記録を削除できませんでした。", error);
      return false;
    }
  }

  function getStreak(now = Date.now()) {
    const dates = new Set(data.d);
    let cursor = toJapanDateKey(now);
    if (!dates.has(cursor)) {
      cursor = shiftDateKey(cursor, -1);
      if (!dates.has(cursor)) {
        return 0;
      }
    }
    let streak = 0;
    while (dates.has(cursor)) {
      streak += 1;
      cursor = shiftDateKey(cursor, -1);
    }
    return streak;
  }

  function getMutableRecord(questionId) {
    data.q[questionId] = normalizeRecord(data.q[questionId]);
    return data.q[questionId];
  }

  function removeEmptyRecord(questionId) {
    const record = data.q[questionId];
    if (record && record[0] === 0 && record[5] === 0) {
      delete data.q[questionId];
    }
  }

  function addStudyDay(dateKey) {
    if (!data.d.includes(dateKey)) {
      data.d.push(dateKey);
      data.d.sort();
    }
  }

  function persist(value) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error("学習記録を保存できませんでした。", error);
      return false;
    }
  }

  function toPublicRecord(record) {
    const normalized = normalizeRecord(record);
    return {
      attempts: normalized[0],
      correct: normalized[1],
      lastCorrect: normalized[2] === -1 ? null : normalized[2] === 1,
      answeredAt: normalized[3] || null,
      history: normalized[4],
      checked: normalized[5] === 1,
    };
  }

  function emptyPublicRecord() {
    return { attempts: 0, correct: 0, lastCorrect: null, answeredAt: null, history: "", checked: false };
  }

  function toJapanDateKey(timestamp) {
    const parts = Object.fromEntries(
      dateFormatter.formatToParts(new Date(timestamp)).map((part) => [part.type, part.value]),
    );
    return `${parts.year}${parts.month}${parts.day}`;
  }

  function shiftDateKey(dateKey, days) {
    const year = Number(dateKey.slice(0, 4));
    const month = Number(dateKey.slice(4, 6));
    const day = Number(dateKey.slice(6, 8));
    const shifted = new Date(Date.UTC(year, month - 1, day + days));
    return [shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate()]
      .map((value, index) => (index === 0 ? String(value) : String(value).padStart(2, "0")))
      .join("");
  }

  function isDateKey(value) {
    return /^\d{8}$/.test(String(value));
  }

  function percentage(correct, attempts) {
    return attempts ? Math.round((correct / attempts) * 100) : 0;
  }

  function toCount(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0;
  }
})();
