import Dexie, { type Table } from 'dexie';

// ==========================================
// 1. 翻訳結果のデータ構造 (PhraseItem)
// ==========================================
// APIから返ってくるパース結果（意図や直訳など）を安全に保存するための型定義
export interface PhraseItem {
  original: string;
  pronunciation: string;
  translated: string;
  intent?: string;      // 意図 (追加)
  literal?: string;     // 直訳 (追加)
  partnerMsg?: string;  // 相手へのメッセージ (追加)
}

// ==========================================
// 2. スタイル設定のデータ構造 (ChatStylePreset)
// ==========================================
// Kotlin版の DataModels.kt に準拠した全項目
export interface ChatStylePreset {
  id?: number;
  name: string;
  myLang: string;
  myLocaleCode: string;
  partnerLang: string;
  partnerLocaleCode: string;
  myGender: string;
  partnerGender: string;
  relationship: string;
  baseTone: string;
  pattern1: string;
  pattern2: string;
  pattern3: string;
  voiceId: string; // Gemini TTSで発話させるための重要なパラメータ
}

// ==========================================
// 3. チャット履歴のデータ構造 (ChatTurnEntity)
// ==========================================
// 1回の翻訳実行（1つの吹き出し）を管理する型定義
export interface ChatTurnEntity {
  id?: number;
  styleId: number;           // どのスタイルで実行されたか（スタイル削除時の連動用）
  input: string;             // 入力したテキスト
  isMe: boolean;             // 自分(true) か 相手(false) か
  suggestions: PhraseItem[]; // 複数パターンの同時翻訳結果を配列で保持
  timestamp: number;         // 並び替え用のタイムスタンプ
}

// ==========================================
// 4. ローカルデータベースの定義 (Dexie)
// ==========================================
export class AppDatabase extends Dexie {
  styles!: Table<ChatStylePreset, number>;
  history!: Table<ChatTurnEntity, number>;

  constructor() {
    super('Shabelink2_DB');
    
    // テーブルと検索用インデックスの定義
    // ++id は自動採番されるプライマリキー
    this.version(1).stores({
      styles: '++id, name',
      history: '++id, styleId, timestamp'
    });
  }
}

export const db = new AppDatabase();