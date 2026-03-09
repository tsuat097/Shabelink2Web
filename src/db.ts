import Dexie, { type Table } from 'dexie';

export interface ChatStylePreset {
  id?: number;
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

export interface PhraseItem {
  original: string;
  pronunciation: string;
  translated: string;
}

export interface ChatTurnEntity {
  id?: number;
  styleId: number;
  input: string;
  isMe: boolean;
  suggestions: PhraseItem[];
  timestamp: number;
}

export class Shabelink2DB extends Dexie {
  styles!: Table<ChatStylePreset>;
  history!: Table<ChatTurnEntity>;

  constructor() {
    super('Shabelink2WebDB');
    this.version(1).stores({
      styles: '++id, name',
      history: '++id, styleId, timestamp' 
    });
  }
}

export const db = new Shabelink2DB();