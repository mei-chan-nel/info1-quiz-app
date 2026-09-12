(() => {
  "use strict";

  const STORAGE_KEY = "info1QuizPreferences:v1";
  const PREFERENCES_VERSION = 1;
  const FIELD_IDS = [
    "society_security",
    "digital",
    "network",
    "data_db",
    "algorithm",
    "design",
  ];
  const FIELD_ID_SET = new Set(FIELD_IDS);
  const ANSWER_MODES = new Set(["all", "unanswered", "wrong", "exclude_mastered"]);
  const CALC_MODES = new Set(["all", "without", "only"]);
  const DEFAULTS = Object.freeze({
    fields: Object.freeze([...FIELD_IDS]),
    answerMode: "all",
    calcMode: "all",
    setSize: 5,
  });

  window.Info1QuizPreferences = Object.freeze({
    load,
    save,
    getStorageKey: () => STORAGE_KEY,
  });

  function load() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      return normalize(parsed);
    } catch (error) {
      console.warn("出題設定を読み込めませんでした。初期設定を使用します。", error);
      return defaults();
    }
  }

  function save(preferences) {
    const normalized = normalize({ ...preferences, v: PREFERENCES_VERSION });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        v: PREFERENCES_VERSION,
        fields: normalized.fields,
        answerMode: normalized.answerMode,
        calcMode: normalized.calcMode,
        setSize: normalized.setSize,
      }));
      return true;
    } catch (error) {
      console.warn("出題設定を保存できませんでした。", error);
      return false;
    }
  }

  function normalize(value) {
    if (!value || value.v !== PREFERENCES_VERSION || typeof value !== "object") {
      return defaults();
    }

    const requestedFields = Array.isArray(value.fields) ? value.fields : null;
    const validFields = requestedFields
      ? [...new Set(requestedFields.map(String).filter((fieldId) => FIELD_ID_SET.has(fieldId)))]
      : [...DEFAULTS.fields];
    const fields = requestedFields && (requestedFields.length === 0 || validFields.length > 0)
      ? validFields
      : [...DEFAULTS.fields];
    const setSize = Number(value.setSize);

    return {
      fields,
      answerMode: ANSWER_MODES.has(value.answerMode) ? value.answerMode : DEFAULTS.answerMode,
      calcMode: CALC_MODES.has(value.calcMode) ? value.calcMode : DEFAULTS.calcMode,
      setSize: Number.isInteger(setSize) && setSize >= 1 && setSize <= 50
        ? setSize
        : DEFAULTS.setSize,
    };
  }

  function defaults() {
    return {
      fields: [...DEFAULTS.fields],
      answerMode: DEFAULTS.answerMode,
      calcMode: DEFAULTS.calcMode,
      setSize: DEFAULTS.setSize,
    };
  }
})();
