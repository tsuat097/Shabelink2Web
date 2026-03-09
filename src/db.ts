// src/db.ts
import Dexie, { type  Table} from 'dexie';

// 1. DataModels.kt の PhraseItem に相当
export interface PhraseItem {
  original: string;
  pronunciation: string;
  translated: string;
}

// 2. AppDatabase.kt の ChatTurnEntity に相当
export interface ChatTurnEntity {
  id?: number; // autoGenerate = true のためオプショナル(?)にする
  styleId: string;
  input: string;
  isMe: boolean;
  suggestions: PhraseItem[];
}

// DataModels.kt の ChatStylePreset に相当 (Web版ではプリセットもDBに入れると管理が楽です)
export interface ChatStylePreset {
  id: string;
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
}

// 3. Database (データベース本体)
export class AppDatabase extends Dexie {
  // テーブルの宣言
  chatTurns!: Table<ChatTurnEntity, number>;
  presets!: Table<ChatStylePreset, string>;

  constructor() {
    super('Shabelink2Database');
    
    // テーブルの定義 (検索条件に使う項目だけをインデックスとして指定します)
    this.version(1).stores({
      chatTurns: '++id, styleId', // ++id はオートインクリメント
      presets: 'id'               // UUIDを主キーにする
    });
  }
}

// データベースのインスタンスを作成してエクスポート
export const db = new AppDatabase();