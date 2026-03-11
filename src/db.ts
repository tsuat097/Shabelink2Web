// src/db.ts

import Dexie, { type Table } from 'dexie';

// LocaleInfo (for STT/TTS)
export type LocaleInfo = {
  code: string;
  displayName: string;
};

// VoiceInfo (for Gemini TTS)
export type VoiceInfo = {
  id: string;
  displayName: string;
};

// ChatStylePreset (スタイル定義)
export type ChatStylePreset = {
  id?: number; // Dexie の auto-increment primary key
  name: string;
  myLang: string;
  myLocaleCode: string;
  partnerLang: string;
  partnerLocaleCode: string;
  baseTone: string;
  pattern1: string;
  pattern2: string;
  pattern3: string;
  myGender: string;
  partnerGender: string;
  relationship: string;
  voiceId: string;
};

// ChatTurnEntity (履歴の1ターン)
export type ChatTurnEntity = {
  id?: number; // Dexie の auto-increment primary key
  styleId: number; // 関連する ChatStylePreset の id
  input: string;
  isMe: boolean;
  suggestions: PhraseItem[];
  timestamp: number;
};

// PhraseItem (翻訳結果の1項目)
export type PhraseItem = {
  original: string;
  pronunciation: string;
  translated: string;
  intent?: string;
  literal?: string;
  partnerMsg?: string;
};


// Dexie DB設定
export class MySubClassedDexie extends Dexie {
  styles!: Table<ChatStylePreset>;
  history!: Table<ChatTurnEntity>;

  constructor() {
    super('shabelink2Db');
    this.version(1).stores({
      styles: '++id, name',
      history: '++id, styleId, timestamp'
    });
  }
}

export const db = new MySubClassedDexie();


// supportedLocales for Android (Google STT/TTS)
export const supportedLocales: LocaleInfo[] = [
    { code: "af-ZA", displayName: "アフリカーンス語 (南アフリカ)" },
    { code: "am-ET", displayName: "アムハラ語 (エチオピア)" },
    { code: "ar-AE", displayName: "アラビア語 (アラブ首長国連邦)" },
    { code: "ar-BH", displayName: "アラビア語 (バーレーン)" },
    { code: "ar-DZ", displayName: "アラビア語 (アルジェリア)" },
    { code: "ar-EG", displayName: "アラビア語 (エジプト)" },
    { code: "ar-IL", displayName: "アラビア語 (イスラエル)" },
    { code: "ar-IQ", displayName: "アラビア語 (イラク)" },
    { code: "ar-JO", displayName: "アラビア語 (ヨルダン)" },
    { code: "ar-KW", displayName: "アラビア語 (クウェート)" },
    { code: "ar-LB", displayName: "アラビア語 (レバノン)" },
    { code: "ar-MA", displayName: "アラビア語 (モロッコ)" },
    { code: "ar-OM", displayName: "アラビア語 (オマーン)" },
    { code: "ar-PS", displayName: "アラビア語 (パレスチナ)" },
    { code: "ar-QA", displayName: "アラビア語 (カタール)" },
    { code: "ar-SA", displayName: "アラビア語 (サウジアラビア)" },
    { code: "ar-TN", displayName: "アラビア語 (チュニジア)" },
    { code: "az-AZ", displayName: "アゼルバイジャン語 (アゼルバイジャン)" },
    { code: "bg-BG", displayName: "ブルガリア語 (ブルガリア)" },
    { code: "bn-BD", displayName: "ベンガル語 (バングラデシュ)" },
    { code: "bn-IN", displayName: "ベンガル語 (インド)" },
    { code: "ca-ES", displayName: "カタロニア語 (スペイン)" },
    { code: "cs-CZ", displayName: "チェコ語 (チェコ)" },
    { code: "da-DK", displayName: "デンマーク語 (デンマーク)" },
    { code: "de-AT", displayName: "ドイツ語 (オーストリア)" },
    { code: "de-CH", displayName: "ドイツ語 (スイス)" },
    { code: "de-DE", displayName: "ドイツ語 (ドイツ)" },
    { code: "el-GR", displayName: "ギリシャ語 (ギリシャ)" },
    { code: "en-AU", displayName: "英語 (オーストラリア)" },
    { code: "en-CA", displayName: "英語 (カナダ)" },
    { code: "en-GB", displayName: "英語 (イギリス)" },
    { code: "en-GH", displayName: "英語 (ガーナ)" },
    { code: "en-IE", displayName: "英語 (アイルランド)" },
    { code: "en-IN", displayName: "英語 (インド)" },
    { code: "en-KE", displayName: "英語 (ケニア)" },
    { code: "en-NG", displayName: "英語 (ナイジェリア)" },
    { code: "en-NZ", displayName: "英語 (ニュージーランド)" },
    { code: "en-PH", displayName: "英語 (フィリピン)" },
    { code: "en-SG", displayName: "英語 (シンガポール)" },
    { code: "en-TZ", displayName: "英語 (タンザニア)" },
    { code: "en-US", displayName: "英語 (アメリカ合衆国)" }, 
    { code: "en-ZA", displayName: "英語 (南アフリカ)" },
    { code: "es-AR", displayName: "スペイン語 (アルゼンチン)" },
    { code: "es-BO", displayName: "スペイン語 (ボリビア)" },
    { code: "es-CL", displayName: "スペイン語 (チリ)" },
    { code: "es-CO", displayName: "スペイン語 (コロンビア)" },
    { code: "es-CR", displayName: "スペイン語 (コスタリカ)" },
    { code: "es-DO", displayName: "スペイン語 (ドミニカ共和国)" },
    { code: "es-EC", displayName: "スペイン語 (エクアドル)" },
    { code: "es-ES", displayName: "スペイン語 (スペイン)" },
    { code: "es-GT", displayName: "スペイン語 (グアテマラ)" },
    { code: "es-HN", displayName: "スペイン語 (ホンジュラス)" },
    { code: "es-MX", displayName: "スペイン語 (メキシコ)" },
    { code: "es-NI", displayName: "スペイン語 (ニカラグア)" },
    { code: "es-PA", displayName: "スペイン語 (パナマ)" },
    { code: "es-PE", displayName: "スペイン語 (ペルー)" },
    { code: "es-PR", displayName: "スペイン語 (プエルトリコ)" },
    { code: "es-PY", displayName: "スペイン語 (パラグアイ)" },
    { code: "es-SV", displayName: "スペイン語 (エルサルバドル)" },
    { code: "es-US", displayName: "スペイン語 (アメリカ合衆国)" },
    { code: "es-UY", displayName: "スペイン語 (ウルグアイ)" },
    { code: "es-VE", displayName: "スペイン語 (ベネズエラ)" },
    { code: "et-EE", displayName: "エストニア語 (エストニア)" },
    { code: "eu-ES", displayName: "バスク語 (スペイン)" },
    { code: "fa-IR", displayName: "ペルシャ語 (イラン)" },
    { code: "fi-FI", displayName: "フィンランド語 (フィンランド)" },
    { code: "fil-PH", displayName: "フィリピノ語 (フィリピン)" },
    { code: "fr-BE", displayName: "フランス語 (ベルギー)" },
    { code: "fr-CA", displayName: "フランス語 (カナダ)" },
    { code: "fr-CH", displayName: "フランス語 (スイス)" },
    { code: "fr-FR", displayName: "フランス語 (フランス)" },
    { code: "gl-ES", displayName: "ガリシア語 (スペイン)" },
    { code: "gu-IN", displayName: "グジャラート語 (インド)" },
    { code: "he-IL", displayName: "ヘブライ語 (イスラエル)" },
    { code: "hi-IN", displayName: "ヒンディー語 (インド)" },
    { code: "hr-HR", displayName: "クロアチア語 (クロアチア)" },
    { code: "hu-HU", displayName: "ハンガリー語 (ハンガリー)" },
    { code: "id-ID", displayName: "インドネシア語 (インドネシア)" },
    { code: "is-IS", displayName: "アイスランド語 (アイスランド)" },
    { code: "it-CH", displayName: "イタリア語 (スイス)" },
    { code: "it-IT", displayName: "イタリア語 (イタリア)" },
    { code: "ja-JP", displayName: "日本語 (日本)" },
    { code: "jv-ID", displayName: "ジャワ語 (インドネシア)" },
    { code: "ka-GE", displayName: "ジョージア語 (ジョージア)" },
    { code: "km-KH", displayName: "クメール語 (カンボジア)" },
    { code: "kn-IN", displayName: "カンナダ語 (インド)" },
    { code: "ko-KR", displayName: "韓国語 (韓国)" },
    { code: "lo-LA", displayName: "ラオ語 (ラオス)" },
    { code: "lt-LT", displayName: "リトアニア語 (リトアニア)" },
    { code: "lv-LV", displayName: "ラトビア語 (ラトビア)" },
    { code: "mk-MK", displayName: "マケドニア語 (北マケドニア)" },
    { code: "ml-IN", displayName: "マラヤラム語 (インド)" },
    { code: "mr-IN", displayName: "マラーティー語 (インド)" },
    { code: "ms-MY", displayName: "マレー語 (マレーシア)" },
    { code: "my-MM", displayName: "ビルマ語 (ミャンマー)" },
    { code: "ne-NP", displayName: "ネパール語 (ネパール)" },
    { code: "nl-BE", displayName: "オランダ語 (ベルギー)" },
    { code: "nl-NL", displayName: "オランダ語 (オランダ)" },
    { code: "no-NO", displayName: "ノルウェー語 (ノルウェー)" },
    { code: "pa-IN", displayName: "パンジャブ語 (インド)" },
    { code: "pl-PL", displayName: "ポーランド語 (ポーランド)" },
    { code: "pt-BR", displayName: "ポルトガル語 (ブラジル)" },
    { code: "pt-PT", displayName: "ポルトガル語 (ポルトガル)" },
    { code: "ro-RO", displayName: "ルーマニア語 (ルーマニア)" },
    { code: "ru-RU", displayName: "ロシア語 (ロシア)" },
    { code: "si-LK", displayName: "シンハラ語 (スリランカ)" },
    { code: "sk-SK", displayName: "スロバキア語 (スロバキア)" },
    { code: "sl-SI", displayName: "スロベニア語 (スロベニア)" },
    { code: "sq-AL", displayName: "アルバニア語 (アルバニア)" },
    { code: "sr-RS", displayName: "セルビア語 (セルビア)" },
    { code: "su-ID", displayName: "スンダ語 (インドネシア)" },
    { code: "sv-SE", displayName: "スウェーデン語 (スウェーデン)" },
    { code: "sw-KE", displayName: "スワヒリ語 (ケニア)" },
    { code: "sw-TZ", displayName: "スワヒリ語 (タンザニア)" },
    { code: "ta-IN", displayName: "タミル語 (インド)" },
    { code: "ta-LK", displayName: "タミル語 (スリランカ)" },
    { code: "ta-MY", displayName: "タミル語 (マレーシア)" },
    { code: "ta-SG", displayName: "タミル語 (シンガポール)" },
    { code: "te-IN", displayName: "テルグ語 (インド)" },
    { code: "th-TH", displayName: "タイ語 (タイ)" },
    { code: "tr-TR", displayName: "トルコ語 (トルコ)" },
    { code: "uk-UA", displayName: "ウクライナ語 (ウクライナ)" },
    { code: "ur-IN", displayName: "ウルドゥー語 (インド)" },
    { code: "ur-PK", displayName: "ウルドゥー語 (パキスタン)" },
    { code: "uz-UZ", displayName: "ウズベク語 (ウズベキスタン)?" }, // ?を追加
    { code: "vi-VN", displayName: "ベトナム語 (ベトナム)" },
    { code: "yue-Hant-HK", displayName: "広東語 (香港)" },
    { code: "zh-CN", displayName: "中国語 (簡体字・中国)" },
    { code: "zh-HK", displayName: "中国語 (繁体字・香港)" },
    { code: "zh-TW", displayName: "中国語 (繁体字・台湾)" },
    { code: "zu-ZA", displayName: "ズールー語 (南アフリカ)" }
];

// actingVoices (for Gemini TTS)
export const actingVoices: VoiceInfo[] = [
    // 女性的な声 (14種類)
    { id: "zephyr", displayName: "Zephyr [女性・高音] Bright (明るい)" },
    { id: "despina", displayName: "Despina [女性・高音] Smooth (滑らか)" },
    { id: "erinome", displayName: "Erinome [女性・高音] Clear (クリア)" },
    { id: "vindemiatrix", displayName: "Vindemiatrix [女性・低音] Gentle (穏やか)" },
    { id: "sulafat", displayName: "Sulafat [女性・高音] Warm (温かい)" },
    { id: "kore", displayName: "Kore [女性・高音]" },
    { id: "leda", displayName: "Leda [女性・高音]" },
    { id: "aoede", displayName: "Aoede [女性・高音]" },
    { id: "callirrhoe", displayName: "Callirrhoe [女性・高音]" },
    { id: "autonoe", displayName: "Autonoe [女性・高音]" },
    { id: "laomedeia", displayName: "Laomedeia [女性・高音]" },
    { id: "achernar", displayName: "Achernar [女性・高音]" },
    { id: "pulcherrima", displayName: "Pulcherrima [女性・高音]" },
    { id: "gacrux", displayName: "Gacrux [女性・低音]" },

    // 男性的な声 (16種類)
    { id: "puck", displayName: "Puck [男性・低音] Upbeat (快活)" },
    { id: "charon", displayName: "Charon [男性・低音] Informative (情報伝達・落ち着いた)" },
    { id: "enceladus", displayName: "Enceladus [男性・低音] Breathy (息混じり)" },
    { id: "iapetus", displayName: "Iapetus [男性・高音] Clear (クリア)" },
    { id: "umbriel", displayName: "Umbriel [男性・高音] Easy-going (のんびり)" },
    { id: "algieba", displayName: "Algieba [男性・低音] Smooth (滑らか)" },
    { id: "sadachbia", displayName: "Sadachbia [男性・高音] Lively (生き生きとした)" },
    { id: "sadaltager", displayName: "Sadaltager [男性・低音] Knowledgeable (知識が豊富そう)" },
    { id: "achird", displayName: "Achird [男性・高音]" },
    { id: "alnilam", displayName: "Alnilam [男性・高音]" },
    { id: "fenrir", displayName: "Fenrir [男性・高音]" },
    { id: "orus", displayName: "Orus [男性・高音]" },
    { id: "rasalgethi", displayName: "Rasalgethi [男性・高音]" },
    { id: "schedar", displayName: "Schedar [男性・高音]" },
    { id: "algenib", displayName: "Algenib [男性・低音]" },
    { id: "zubenelgenubi", displayName: "Zubenelgenubi [男性・低音]" }
];
