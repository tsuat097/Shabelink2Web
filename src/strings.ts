// src/strings.ts

const dictionary = {
  ja: {
    meSpeaking: "自分が話す",
    partnerSpeaking: "相手が話す",
    inputPlaceholder: "入力...",
    partnerMsgLabel: "相手",
    translating: "⏳ AI思考中...",
    translateBtn: "翻訳・返答を生成",
    pattern: "パターン",
    literal: "直訳",
    intent: "意図",
    pron: "発音", // 'pronLabel' から 'pron' に修正
    noTranslation: "(翻訳結果なし)",
    settingsTitle: "設定",
    debugToggle: "デバッグ情報を表示",
    exportBtn: "📁 エクスポート",
    importBtn: "💾 インポート",
    deleteHistoryBtn: "🗑️ このスタイルの履歴を削除",
    closeBtn: "閉じる",
    cancelBtn: "キャンセル",
    saveBtn: "保存",
    importSelectTitle: "インポートするスタイルを選択",
    overwriteBadge: "上書き",
    addNewBadge: "新規追加",
    importExecuteBtn: "インポート実行",

    // スタイル編集画面用
    styleNew: "スタイル新規作成",
    styleEdit: "スタイル編集",
    styleName: "スタイル名 (必須)",
    myLang: "自分の言語",
    myLocale: "ロケール (My)",
    partnerLang: "相手の言語",
    partnerLocale: "ロケール (Partner)",
    myGender: "自分の性別",
    partnerGender: "相手の性別",
    relationship: "関係性",
    baseTone: "ベースの口調",
    voiceId: "ボイスID (VoiceId)",
    pattern1: "パターン1 (必須)",
    pattern2: "パターン2 (任意)",
    pattern3: "パターン3 (任意)",

    // 追加：発言バブルの接頭辞
    mePrefix: "自分: ",
    partnerPrefix: "相手: ",

    // 追加：TTSエンジン表示
    ttsAi: "AI",
    ttsDevice: "端末",
    ttsAiTitle: "AI音声（GeminiTTS）",
    ttsDeviceTitle: "端末音声（speechSynthesis）",

    // 追加：スピーカーボタンのツールチップ
    ttsPlay: "読み上げ",
    ttsStop: "停止",
    ttsLoading: "読み上げ準備中...",

    // 追加：音声入力ボタンのツールチップ
    sttInput: "音声入力",
    sttStop: "音声入力を停止"
  },

  en: {
    meSpeaking: "I speak",
    partnerSpeaking: "Partner speaks",
    inputPlaceholder: "Input...",
    partnerMsgLabel: "Partner",
    translating: "⏳ Thinking...",
    translateBtn: "Translate / Reply",
    pattern: "Pattern",
    literal: "Literal",
    intent: "Intent",
    pron: "Pronunciation", // 'pronLabel' から 'pron' に修正
    noTranslation: "(No translation)",
    settingsTitle: "Settings",
    debugToggle: "Show Debug Info",
    exportBtn: "📁 Export",
    importBtn: "💾 Import",
    deleteHistoryBtn: "🗑️ Delete History for this Style",
    closeBtn: "Close",
    cancelBtn: "Cancel",
    saveBtn: "Save",
    importSelectTitle: "Select Styles to Import",
    overwriteBadge: "Overwrite",
    addNewBadge: "New",
    importExecuteBtn: "Execute Import",

    styleNew: "Create New Style",
    styleEdit: "Edit Style",
    styleName: "Style Name (Required)",
    myLang: "My Language",
    myLocale: "My Locale",
    partnerLang: "Partner Language",
    partnerLocale: "Partner Locale",
    myGender: "My Gender",
    partnerGender: "Partner Gender",
    relationship: "Relationship",
    baseTone: "Base Tone",
    voiceId: "Voice ID",
    pattern1: "Pattern 1 (Required)",
    pattern2: "Pattern 2 (Optional)",
    pattern3: "Pattern 3 (Optional)",

    mePrefix: "Me: ",
    partnerPrefix: "Partner: ",

    ttsAi: "AI",
    ttsDevice: "Device",
    ttsAiTitle: "AI voice (GeminiTTS)",
    ttsDeviceTitle: "Device voice (speechSynthesis)",

    ttsPlay: "Play",
    ttsStop: "Stop",
    ttsLoading: "Loading...",

    sttInput: "Voice Input",
    sttStop: "Stop Voice Input"
  }
};

export type StringKey = keyof typeof dictionary.ja;

export const getString = (key: StringKey): string => {
  const userLang = navigator.language.startsWith('ja') ? 'ja' : 'en';
  // 型エラー回避のため as StringKey を使用
  return dictionary[userLang][key] || dictionary.ja[key];
};
