// src/App.tsx
import { useState, useCallback, useEffect, useRef, type ChangeEvent } from 'react';
import { runTranslation, type TranslationResult } from './GeminiApi';
import { speakWithGeminiTtsRest } from './GeminiTts';
import { db, type ChatStylePreset, type ChatTurnEntity, type PhraseItem, supportedLocales, actingVoices } from './db';
import { getString } from './strings';
import './App.css';

// デフォルトのプリセットデータ（配列）を読み込む
import defaultData from './defaultPresets.json';

type TtsStatus = 'idle' | 'loading' | 'playing';
type TtsEngine = 'gemini' | 'device'; // device = speechSynthesis

function App() {
  const [inputText, setInputText] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [isMeSpeaking, setIsMeSpeaking] = useState(true);
  const [apiKey] = useState(import.meta.env.VITE_GEMINI_API_KEY || '');

  const [history, setHistory] = useState<ChatTurnEntity[]>([]);
  const [streamingResults, setStreamingResults] = useState<TranslationResult[] | null>(null);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const debugBodyRef = useRef<HTMLPreElement | null>(null);

  const [showDebug, setShowDebug] = useState(false);
  const [presets, setPresets] = useState<ChatStylePreset[]>([]);
  const [currentStyle, setCurrentStyle] = useState<ChatStylePreset | null>(null);

  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingStyle, setEditingStyle] = useState<Partial<ChatStylePreset>>({});
  const [isAddingNew, setIsAddingNew] = useState(false);

  // インポート選択ダイアログ用
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importCandidates, setImportCandidates] = useState<any[]>([]);
  const [importHistoryData, setImportHistoryData] = useState<any[]>([]);
  const [importSelections, setImportSelections] = useState<boolean[]>([]);

  // エクスポート選択ダイアログ用
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportSelections, setExportSelections] = useState<boolean[]>([]);

  // 音声認識（Web Speech API）
  const recognitionRef = useRef<any>(null);
  const [isListening, setIsListening] = useState(false);

  // ▼▼▼ 二重登録防止用のロック ▼▼▼
  const isInitializingDb = useRef(false);

  // ----------------------------
  // TTS: エンジン切替（カードごと）
  // ----------------------------
  const [ttsEngineByKey, setTtsEngineByKey] = useState<Record<string, TtsEngine>>({});
  const getEngine = (key: string): TtsEngine => ttsEngineByKey[key] ?? 'gemini';
  const setEngine = (key: string, engine: TtsEngine) =>
    setTtsEngineByKey((prev) => ({ ...prev, [key]: engine }));

  // ----------------------------
  // TTS: 状態（カードごと表示）
  // ----------------------------
  const [ttsStatusByKey, setTtsStatusByKey] = useState<Record<string, TtsStatus>>({});
  const getStatus = (key: string): TtsStatus => ttsStatusByKey[key] ?? 'idle';
  const setStatus = (key: string, st: TtsStatus) =>
    setTtsStatusByKey((prev) => ({ ...prev, [key]: st }));

  const [activeTtsKey, setActiveTtsKey] = useState<string | null>(null);
  const ttsAbortRef = useRef<AbortController | null>(null);

  // ----------------------------
  // TTS: ボイスID選択（カードごと）を追加
  // ----------------------------
  const [voiceIdByKey, setVoiceIdByKey] = useState<Record<string, string>>({});
  const getVoiceIdForBubble = (key: string): string => {
    return voiceIdByKey[key] ?? currentStyle?.voiceId ?? 'puck';
  };
  const setVoiceIdForBubble = (key: string, voiceId: string) => {
    setVoiceIdByKey((prev) => ({ ...prev, [key]: voiceId }));
  };

  // ボイス選択モーダルの開閉状態管理
  const [voiceSelectModalConfig, setVoiceSelectModalConfig] = useState<{ isOpen: boolean, ttsKey: string } | null>(null);

  // ==========================================
  // 共通ユーティリティ
  // ==========================================
  const copyText = async (text: string) => {
    const t = (text || '').trim();
    if (!t) return;
    try {
      await navigator.clipboard.writeText(t);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = t;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
  };

  // speechSynthesis（端末TTS）
  const speakDirect = (text: string, lang: string) => {
    const t = (text || '').trim();
    if (!t) return Promise.resolve();
    if (!('speechSynthesis' in window)) return Promise.resolve();

    return new Promise<void>((resolve) => {
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(t);
        u.lang = lang;
        u.onend = () => resolve();
        u.onerror = () => resolve();
        window.speechSynthesis.speak(u);
      } catch {
        resolve();
      }
    });
  };

  const stopAnyTts = () => {
    try {
      ttsAbortRef.current?.abort();
    } catch {
      // ignore
    }
    ttsAbortRef.current = null;

    try {
      window.speechSynthesis?.cancel();
    } catch {
      // ignore
    }

    if (activeTtsKey) setStatus(activeTtsKey, 'idle');
    setActiveTtsKey(null);
  };

  // TTS再生
  const playTts = async (key: string, text: string) => {
    const t = (text || '').trim();
    if (!t || !currentStyle) return;

    const engine = getEngine(key);
    const bubbleVoiceId = getVoiceIdForBubble(key);

    if (activeTtsKey && activeTtsKey !== key) {
      stopAnyTts();
    }

    const st = getStatus(key);
    if (activeTtsKey === key && st !== 'idle') {
      stopAnyTts();
      return;
    }

    setActiveTtsKey(key);

    if (engine === 'device') {
      setStatus(key, 'playing');
      try {
        await speakDirect(t, currentStyle.partnerLocaleCode || 'en-US');
      } finally {
        setStatus(key, 'idle');
        setActiveTtsKey(null);
      }
      return;
    }

    if (!apiKey) {
      alert('APIキーが設定されていません。');
      setStatus(key, 'idle');
      setActiveTtsKey(null);
      return;
    }

    const controller = new AbortController();
    ttsAbortRef.current = controller;
    setStatus(key, 'loading');

    const timeoutId = window.setTimeout(() => controller.abort(), 10000);
    let didFallback = false;

    try {
      const styleForTts = currentStyle.baseTone?.trim() || currentStyle.name;

      await speakWithGeminiTtsRest({
        apiKey,
        text: t,
        style: styleForTts,
        lang: currentStyle.partnerLang || 'English',
        voiceId: bubbleVoiceId,
        signal: controller.signal,
        callbacks: {
          onLog: (m) => setDebugLogs((prev) => [...prev, `[TTS] ${m}`]),
          onLoading: () => setStatus(key, 'loading'),
          onPlaying: () => setStatus(key, 'playing'),
          onDone: () => { },
          onFallback: () => {
            didFallback = true;
          }
        }
      });

      if (didFallback) {
        setStatus(key, 'playing');
        await speakDirect(t, currentStyle.partnerLocaleCode || 'en-US');
      }

    } catch (e: any) {
      setDebugLogs((prev) => [...prev, `[TTS] ❌ ${e?.name || ''} ${e?.message || e}`]);
      setStatus(key, 'playing');
      await speakDirect(t, currentStyle.partnerLocaleCode || 'en-US');
    } finally {
      window.clearTimeout(timeoutId);
      ttsAbortRef.current = null;
      setStatus(key, 'idle');
      setActiveTtsKey(null);
    }
  };

  // 音声認識
  const startSpeechRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('このブラウザは音声認識に対応していません（Chrome系推奨）。');
      return;
    }
    if (!currentStyle) return;

    const rec = new SpeechRecognition();
    recognitionRef.current = rec;

    rec.lang = isMeSpeaking ? currentStyle.myLocaleCode : currentStyle.partnerLocaleCode;
    rec.interimResults = true;
    rec.continuous = false;

    rec.onstart = () => setIsListening(true);
    rec.onend = () => setIsListening(false);
    rec.onerror = () => setIsListening(false);

    rec.onresult = (event: any) => {
      let text = '';
      for (let i = 0; i < event.results.length; i++) {
        text += event.results[i][0].transcript;
      }
      setInputText(text.trim());
    };

    rec.start();
  };

  const stopSpeechRecognition = () => {
    try {
      recognitionRef.current?.stop();
    } catch {
      // ignore
    }
    setIsListening(false);
  };

  // デバッグ：末尾追従
  useEffect(() => {
    if (!showDebug) return;
    const el = debugBodyRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [debugLogs, showDebug]);

  // ==========================================
  // DB初期化と履歴読み込み
  // ==========================================
  const initDB = useCallback(async () => {
    // ★ Reactの二重読み込みによる重複登録を完全にブロックする
    if (isInitializingDb.current) return;
    isInitializingDb.current = true;

    try {
      // DBに入っている件数を正確にカウントする
      const count = await db.styles.count();

      // 1. もしDBが空なら、JSONファイルから一括追加する
      if (count === 0) {
        if (Array.isArray(defaultData) && defaultData.length > 0) {
          await db.styles.bulkAdd(defaultData as ChatStylePreset[]);
        }
      }

      // 2. 読み込んだすべてのスタイルをセット
      const allStyles = await db.styles.toArray();
      setPresets(allStyles);

      // 3. localStorageから前回使っていたスタイルを復元する
      const savedStyleId = localStorage.getItem('lastUsedStyleId');
      let targetStyle = allStyles[0];

      if (savedStyleId) {
        const found = allStyles.find(s => s.id === Number(savedStyleId));
        if (found) {
          targetStyle = found;
        }
      }

      // 4. 現在のスタイルとしてセット
      setCurrentStyle(targetStyle);
      if (targetStyle?.id) loadHistory(targetStyle.id);

    } finally {
      // 処理がすべて終わったらロックを解除する
      isInitializingDb.current = false;
    }
  }, []);

  useEffect(() => {
    initDB();
  }, [initDB]);

  useEffect(() => {
    if (currentStyle?.id) loadHistory(currentStyle.id);
  }, [currentStyle]);

  const loadHistory = async (styleId: number) => {
    const data = await db.history.where('styleId').equals(styleId).toArray();
    const sorted = [...data].sort((a, b) => b.timestamp - a.timestamp);
    setHistory(sorted);
  };

  // ==========================================
  // エクスポート / インポート
  // ==========================================
  const openExportDialog = () => {
    setExportSelections(new Array(presets.length).fill(true));
    setShowSettingsDialog(false);
    setShowExportDialog(true);
  };

  const executeExport = () => {
    const selectedStyles = presets.filter((_, idx) => exportSelections[idx]);

    if (selectedStyles.length === 0) {
      alert('エクスポートするスタイルを1つ以上選択してください。');
      return;
    }

    try {
      const blob = new Blob([JSON.stringify(selectedStyles, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `shabelink2_styles_${new Date().getTime()}.json`;
      a.click();
      URL.revokeObjectURL(url);

      setShowExportDialog(false);
    } catch (e) {
      alert('エクスポートに失敗しました。');
      console.error(e);
    }
  };

  const handleImportJson = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const json = JSON.parse(text);

        const extractStyles = (obj: any): any[] => {
          let found: any[] = [];
          if (Array.isArray(obj)) {
            if (obj.length > 0 && (obj[0].pattern1 !== undefined || obj[0].myLang !== undefined || obj[0].name !== undefined)) return obj;
            obj.forEach((item) => (found = found.concat(extractStyles(item))));
          } else if (obj && typeof obj === 'object') {
            if (obj.pattern1 !== undefined || obj.myLang !== undefined || obj.name !== undefined) return [obj];
            Object.keys(obj).forEach((key) => (found = found.concat(extractStyles(obj[key]))));
          }
          return found;
        };

        const extractHistory = (obj: any): any[] => {
          let found: any[] = [];
          if (Array.isArray(obj)) {
            if (obj.length > 0 && obj[0].input !== undefined) return obj;
            obj.forEach((item) => (found = found.concat(extractHistory(item))));
          } else if (obj && typeof obj === 'object') {
            if (obj.input !== undefined) return [obj];
            Object.keys(obj).forEach((key) => (found = found.concat(extractHistory(obj[key]))));
          }
          return found;
        };

        const extractedStyles = extractStyles(json);
        const extractedHistory = extractHistory(json);

        if (extractedStyles.length === 0) {
          alert('⚠️ インポート可能なスタイルデータが見つかりませんでした。');
          return;
        }

        const existingStyles = await db.styles.toArray();
        const existingStyleMap = new Map<string, number>();
        existingStyles.forEach((s) => existingStyleMap.set(s.name, s.id!));

        const candidates = extractedStyles.map((oldStyle) => {
          const styleName = oldStyle.name || oldStyle.styleName || 'インポートされたスタイル';
          const isOverwrite = existingStyleMap.has(styleName);

          const parsedStyle: ChatStylePreset = {
            name: styleName,
            myLang: oldStyle.myLang || '日本語',
            myLocaleCode: oldStyle.myLocaleCode || 'ja-JP',
            partnerLang: oldStyle.partnerLang || '中国語',
            partnerLocaleCode: oldStyle.partnerLocaleCode || 'zh-CN',
            myGender: oldStyle.myGender || '',
            partnerGender: oldStyle.partnerGender || '',
            relationship: oldStyle.relationship || '',
            baseTone: oldStyle.baseTone || '',
            pattern1: oldStyle.pattern1 || oldStyle.pattern || '自然な会話として翻訳してください。',
            pattern2: oldStyle.pattern2 || '',
            pattern3: oldStyle.pattern3 || '',
            voiceId: oldStyle.voiceId || 'puck'
          };

          return {
            originalOldId: oldStyle.id,
            parsedStyle,
            isOverwrite,
            existingId: isOverwrite ? existingStyleMap.get(styleName) : undefined
          };
        });

        setImportCandidates(candidates);
        setImportHistoryData(extractedHistory);
        setImportSelections(new Array(candidates.length).fill(true));

        setShowSettingsDialog(false);
        setShowImportDialog(true);
      } catch (error) {
        console.error('Import Error:', error);
        alert('❌ インポートに失敗しました。ファイルが破損しているか、JSON形式ではありません。');
      }
    };

    reader.readAsText(file);
    e.target.value = '';
  };

  const executeImport = async () => {
    try {
      const styleIdMap = new Map<number, number>();
      let importedStylesCount = 0;

      for (let i = 0; i < importCandidates.length; i++) {
        if (!importSelections[i]) continue;

        const candidate = importCandidates[i];
        let finalStyleId: number;

        if (candidate.isOverwrite && candidate.existingId) {
          finalStyleId = candidate.existingId;
          await db.styles.update(finalStyleId, candidate.parsedStyle);
        } else {
          finalStyleId = (await db.styles.add(candidate.parsedStyle)) as number;
        }

        if (candidate.originalOldId !== undefined) styleIdMap.set(candidate.originalOldId, finalStyleId);
        importedStylesCount++;
      }

      let importedHistoryCount = 0;
      for (const h of importHistoryData) {
        const newHistoryId = h.styleId !== undefined && styleIdMap.has(h.styleId) ? styleIdMap.get(h.styleId) : undefined;
        if (newHistoryId !== undefined) {
          const newTurn: ChatTurnEntity = {
            styleId: newHistoryId,
            input: h.input || '',
            isMe: h.isMe !== undefined ? h.isMe : true,
            suggestions: h.suggestions || [],
            timestamp: h.timestamp || Date.now()
          };
          await db.history.add(newTurn);
          importedHistoryCount++;
        }
      }

      const allStyles = await db.styles.toArray();
      setPresets([...allStyles]);
      if (allStyles.length > 0) {
        const lastStyle = allStyles[allStyles.length - 1];
        setCurrentStyle(lastStyle);
        loadHistory(lastStyle.id!);
      }

      setShowImportDialog(false);
      alert(`✅ インポート完了\n${importedStylesCount}件のスタイルと ${importedHistoryCount}件の履歴を反映しました。`);
    } catch (e) {
      alert('インポート実行中にエラーが発生しました。');
      console.error(e);
    }
  };

  // ==========================================
  // 翻訳実行
  // ==========================================
  const handleTranslate = async () => {
    if (!inputText.trim() || !currentStyle || !currentStyle.id) return;

    setIsTranslating(true);
    setDebugLogs([]);

    if (!apiKey) {
      alert('APIキーが設定されていません。(.envファイルを確認してください)');
      setIsTranslating(false);
      return;
    }

    const activePatterns = [currentStyle.pattern1, currentStyle.pattern2, currentStyle.pattern3]
      .map((p) => p?.trim())
      .filter((p) => p && p.length > 0) as string[];

    if (activePatterns.length === 0) {
      alert('パターンが1つも設定されていません。スタイル編集からパターンを入力してください。');
      setIsTranslating(false);
      return;
    }

    setStreamingResults(
      activePatterns.map(
        (): TranslationResult => ({ trans: '', pron: '', intent: '', literal: '', partnerMsg: '' })
      )
    );

    try {
      const translationPromises: Promise<TranslationResult | null>[] = activePatterns.map(async (pattern, index) => {
        let finalRes: TranslationResult | null = null;

        await runTranslation(
          apiKey,
          inputText,
          currentStyle,
          isMeSpeaking,
          pattern,
          (logMsg: string) => setDebugLogs((prev) => [...prev, `[Pattern ${index + 1}] ${logMsg}`]),
          (res: TranslationResult) => {
            setStreamingResults((prev) => {
              if (!prev) return prev;
              const newArr = [...prev];
              newArr[index] = { ...res };
              return newArr;
            });
            finalRes = res;
          }
        );

        return finalRes;
      });

      const results = await Promise.all(translationPromises);

      const newSuggestions: PhraseItem[] = results.map((res: TranslationResult | null) => {
        if (!res) return { original: '', pronunciation: '', translated: '(エラー)' };

        const combinedDetailsForSave = [
          !isMeSpeaking && res.partnerMsg ? `【${getString('partnerMsgLabel')}】 ${res.partnerMsg}` : null,
          res.intent ? `【${getString('intent')}】 ${res.intent}` : null,
          res.literal ? `【${getString('literal')}】 ${res.literal}` : null
        ]
          .filter(Boolean)
          .join('\n');

        return {
          original: combinedDetailsForSave,
          pronunciation: res.pron || '',
          translated: res.trans || getString('noTranslation'),
          intent: res.intent || '',
          literal: res.literal || '',
          partnerMsg: res.partnerMsg || ''
        };
      });

      const newTurn: ChatTurnEntity = {
        styleId: currentStyle.id!,
        input: inputText,
        isMe: isMeSpeaking,
        suggestions: newSuggestions,
        timestamp: Date.now()
      };

      await db.history.add(newTurn);
      await loadHistory(currentStyle.id!);

      setInputText('');
      setStreamingResults(null);
    } catch (e: any) {
      console.error('Translation Error:', e);
      alert('翻訳中にエラーが発生しました。\n' + (e.message || ''));
      setDebugLogs((prev) => [...prev, `❌ Error: ${e.message}`]);
      setStreamingResults(null);
    } finally {
      setIsTranslating(false);
    }
  };

  // ==========================================
  // スタイル保存・削除・履歴削除
  // ==========================================
  const handleSaveStyle = async () => {
    if (!editingStyle.name || !editingStyle.pattern1) {
      alert('スタイル名とパターン1は必須です。');
      return;
    }
    let savedId = editingStyle.id;
    if (!isAddingNew && editingStyle.id) {
      await db.styles.update(editingStyle.id, editingStyle as ChatStylePreset);
    } else {
      const newStyle = { ...editingStyle };
      delete (newStyle as any).id;
      savedId = (await db.styles.add(newStyle as ChatStylePreset)) as number;
    }
    const allStyles = await db.styles.toArray();
    setPresets(allStyles);
    setShowEditDialog(false);
    if (isAddingNew || editingStyle.id === currentStyle?.id) {
      setCurrentStyle(allStyles.find((s) => s.id === savedId) || allStyles[0]);
    }
  };

  const handleDeleteStyle = async (id: number) => {
    if (window.confirm('本当にこのスタイルを削除しますか？')) {
      await db.styles.delete(id);
      await db.history.where('styleId').equals(id).delete();
      const allStyles = await db.styles.toArray();
      setPresets(allStyles);
      if (currentStyle?.id === id) {
        setCurrentStyle(allStyles.length > 0 ? allStyles[0] : null);
      }
    }
  };

  const handleDeleteHistory = async () => {
    if (window.confirm('全チャット履歴を削除しますか？')) {
      if (currentStyle?.id) {
        await db.history.where('styleId').equals(currentStyle.id).delete();
        setHistory([]);
        alert('このスタイルの履歴を削除しました。');
      }
    }
  };

  // ==========================================
  // UI
  // ==========================================
  return (
    <div className="app-container">
      {/* Top */}
      <div className="top-bar">
        <div className="top-bar-header">
          <h1>Shabelink2</h1>
          <button className="icon-btn" onClick={() => setShowSettingsDialog(true)} type="button">⚙️</button>
        </div>

        <div className="style-controls-row">
          <select
            className="m3-input m3-select"
            style={{ flex: 1, margin: 0, padding: '8px 32px 8px 12px', background: '#f0edf5', border: 'none', fontWeight: 'bold' }}
            value={currentStyle?.id || ''}
            onChange={(e) => {
              const selectedId = Number(e.target.value);
              const selected = presets.find((p) => p.id === selectedId);
              if (selected) {
                setCurrentStyle(selected);
                localStorage.setItem('lastUsedStyleId', String(selectedId));
              }
            }}
          >
            {presets.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
          </select>

          <button
            className="icon-btn action-btn"
            onClick={() => { setIsAddingNew(true); setEditingStyle({ myLang: '日本語', myLocaleCode: 'ja-JP', partnerLang: '中国語', partnerLocaleCode: 'zh-CN', voiceId: 'puck' }); setShowEditDialog(true); }}
            type="button"
          >➕</button>

          <button
            className="icon-btn action-btn"
            onClick={() => { if (currentStyle) { setIsAddingNew(false); setEditingStyle(currentStyle); setShowEditDialog(true); } }}
            type="button"
          >✏️</button>

          <button className="icon-btn action-btn" onClick={() => currentStyle?.id && handleDeleteStyle(currentStyle.id)} type="button">🗑️</button>
        </div>
      </div>

      {/* Scroll */}
      <div className="scrollable-content">
        {/* Role toggle */}
        <div className="role-toggle-section">
          <span className={`role-label ${!isMeSpeaking ? 'active' : ''}`}>
            {getString('partnerSpeaking')}
          </span>

          <div
            className={`toggle-switch ${isMeSpeaking ? 'me' : 'partner'}`}
            onClick={() => !isTranslating && setIsMeSpeaking(!isMeSpeaking)}
          >
            <div className="toggle-thumb" />
          </div>

          <span className={`role-label ${isMeSpeaking ? 'active' : ''}`}>
            {getString('meSpeaking')}
          </span>
        </div>

        {/* Input */}
        <div className={`textarea-container ${isMeSpeaking ? 'me' : 'partner'} textarea-with-mic`}>
          <textarea
            placeholder={getString('inputPlaceholder')}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={isTranslating}
          />
          <button
            className={`mic-icon-btn ${isListening ? 'listening' : ''}`}
            type="button"
            onClick={isListening ? stopSpeechRecognition : startSpeechRecognition}
            disabled={isTranslating || !currentStyle}
            title={isListening ? "停止" : "入力"}
          >
            🎙️
          </button>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="main-translate-btn" onClick={handleTranslate} disabled={!inputText || isTranslating} style={{ flex: 1 }} type="button">
            {isTranslating ? getString('translating') : getString('translateBtn')}
          </button>
        </div>

        <div className="history-area">
          {/* Streaming */}
          {isTranslating && streamingResults && (
            <div className={`turn-block ${isMeSpeaking ? 'me' : 'partner'}`}>
              <div className={`bubble input-bubble ${isMeSpeaking ? 'me' : 'partner'}`}>
                {(isMeSpeaking ? getString('mePrefix') : getString('partnerPrefix')) + inputText}
              </div>

              <div className={`bubble ai-bubble ${isMeSpeaking ? 'me' : 'partner'} streaming-card`}>
                <div className="suggestions-list">
                  {streamingResults.map((r: TranslationResult, idx: number) => {
                    const ttsKey = `stream-${idx}`;
                    const st = getStatus(ttsKey);
                    const engine = getEngine(ttsKey);
                    const bubbleVoiceId = getVoiceIdForBubble(ttsKey);

                    return (
                      <div key={idx} className="rich-result-container">
                        {streamingResults.length > 1 && <div className="pattern-label">{getString('pattern')} {idx + 1}</div>}

                        {!isMeSpeaking && r.partnerMsg && <div className="res-details">【{getString('partnerMsgLabel')}】 {r.partnerMsg}</div>}
                        {r.intent && <div className="res-details">【{getString('intent')}】 {r.intent}</div>}
                        {r.literal && <div className="res-details">【{getString('literal')}】 {r.literal}</div>}
                        {r.pron && <div className="res-pron">【{getString('pron')}】 {r.pron}</div>}
                        {r.trans && r.trans !== getString('noTranslation') && <div className="res-trans">{r.trans}</div>}

                        <div className="result-footer">
                          {/* ボイス選択 */}
                          <div
                            className="voice-selector-trigger"
                            onClick={() => setVoiceSelectModalConfig({ isOpen: true, ttsKey })}
                          >
                            {actingVoices.find(v => v.id === bubbleVoiceId)?.displayName || bubbleVoiceId}
                          </div>

                          {/* トグル＝エンジン切替 */}
                          <label className="auto-speak" title={engine === 'gemini' ? getString('ttsAiTitle') : getString('ttsDeviceTitle')}>
                            <input
                              type="checkbox"
                              checked={engine === 'gemini'}
                              onChange={(e) => setEngine(ttsKey, e.target.checked ? 'gemini' : 'device')}
                            />
                            <span className="auto-speak-ui" />
                          </label>

                          <span className="tts-engine-label">
                            {engine === 'gemini' ? getString('ttsAi') : getString('ttsDevice')}
                          </span>

                          <div className="footer-actions">
                            <button className="mini-icon-btn" onClick={() => copyText(r.trans || '')} type="button">📋</button>

                            <button
                              className={`mini-icon-btn ${st === 'playing' || st === 'loading' ? 'speaking' : ''}`}
                              onClick={() => playTts(ttsKey, r.trans || '')}
                              type="button"
                              title={
                                st === 'loading' ? getString('ttsLoading')
                                  : st !== 'idle' ? getString('ttsStop')
                                    : getString('ttsPlay')
                              }
                            >
                              <span className="speaker-icon">🔊</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Saved History */}
          {history.map((turn) => (
            <div key={turn.id} className={`turn-block ${turn.isMe ? 'me' : 'partner'}`}>
              <div className={`bubble input-bubble ${turn.isMe ? 'me' : 'partner'}`}>
                {(turn.isMe ? getString('mePrefix') : getString('partnerPrefix')) + turn.input}
              </div>

              <div className={`bubble ai-bubble ${turn.isMe ? 'me' : 'partner'}`}>
                <div className="suggestions-list">
                  {turn.suggestions.map((s, idx) => {
                    const ttsKey = `turn-${String(turn.id)}-${idx}`;
                    const st = getStatus(ttsKey);
                    const engine = getEngine(ttsKey);
                    const bubbleVoiceId = getVoiceIdForBubble(ttsKey);

                    const legacyDetails =
                      s.original && s.original.trim().length > 0 && s.original !== turn.input ? s.original : '';

                    return (
                      <div key={idx} className="rich-result-container">
                        {turn.suggestions.length > 1 && <div className="pattern-label">{getString('pattern')} {idx + 1}</div>}

                        {!turn.isMe && s.partnerMsg && <div className="res-details">【{getString('partnerMsgLabel')}】 {s.partnerMsg}</div>}
                        {s.intent && <div className="res-details">【{getString('intent')}】 {s.intent}</div>}
                        {s.literal && <div className="res-details">【{getString('literal')}】 {s.literal}</div>}

                        {!s.intent && !s.literal && !s.partnerMsg && legacyDetails && (
                          <div className="res-details">{legacyDetails}</div>
                        )}

                        {s.pronunciation && <div className="res-pron">【{getString('pron')}】 {s.pronunciation}</div>}
                        {s.translated && s.translated !== getString('noTranslation') && <div className="res-trans">{s.translated}</div>}

                        <div className="result-footer">
                          {/* ボイス選択 */}
                          <div
                            className="voice-selector-trigger"
                            onClick={() => setVoiceSelectModalConfig({ isOpen: true, ttsKey })}
                          >
                            {actingVoices.find(v => v.id === bubbleVoiceId)?.displayName || bubbleVoiceId}
                          </div>

                          <label className="auto-speak" title={engine === 'gemini' ? getString('ttsAiTitle') : getString('ttsDeviceTitle')}>
                            <input
                              type="checkbox"
                              checked={engine === 'gemini'}
                              onChange={(e) => setEngine(ttsKey, e.target.checked ? 'gemini' : 'device')}
                            />
                            <span className="auto-speak-ui" />
                          </label>

                          <span className="tts-engine-label">
                            {engine === 'gemini' ? getString('ttsAi') : getString('ttsDevice')}
                          </span>

                          <div className="footer-actions">
                            <button className="mini-icon-btn" onClick={() => copyText(s.translated || '')} type="button">📋</button>

                            <button
                              className={`mini-icon-btn ${st === 'playing' || st === 'loading' ? 'speaking' : ''}`}
                              onClick={() => playTts(ttsKey, s.translated || '')}
                              type="button"
                              title={
                                st === 'loading' ? getString('ttsLoading')
                                  : st !== 'idle' ? getString('ttsStop')
                                    : getString('ttsPlay')
                              }
                            >
                              <span className="speaker-icon">🔊</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Debug Drawer (右からのスライドイン) */}
      <div className={`debug-overlay ${showDebug ? 'open' : ''}`} onClick={() => setShowDebug(false)}></div>
      <div className={`debug-drawer ${showDebug ? 'open' : ''}`}>
        <div className="debug-header">
          <span>🛠 Debug Info ({debugLogs.length})</span>
          <button
            onClick={() => setShowDebug(false)}
            style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#fff' }}
            title="閉じる"
            type="button"
          >❌</button>
        </div>

        <pre ref={debugBodyRef} className="debug-body">
          {debugLogs.length === 0 ? 'No logs yet...' : debugLogs.join('\n')}
        </pre>

        <div className="debug-footer">
          <button
            onClick={() => setDebugLogs([])}
            className="m3-filled-btn"
            style={{ width: '100%', background: '#444' }}
            type="button"
          >
            🗑️ ログをクリア
          </button>
        </div>
      </div>

      {/* インポート選択ダイアログ */}
      {showImportDialog && (
        <div className="modal-overlay" onClick={() => setShowImportDialog(false)}>
          <div className="modal-content m3-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">
              <h2 style={{ margin: 0, fontSize: '1.4rem' }}>{getString('importSelectTitle')}</h2>
            </div>

            {/* ▼▼▼ ここにインポートの「全選択」「全解除」ボタンを追加 ▼▼▼ */}
            <div style={{ display: 'flex', gap: '12px', padding: '0 24px', marginTop: '8px' }}>
              <button
                type="button"
                className="m3-text-btn"
                style={{ padding: '4px 8px', fontSize: '0.85rem', minWidth: 'auto', color: '#673ab7' }}
                onClick={() => setImportSelections(new Array(importCandidates.length).fill(true))}
              >
                ✓ 全選択
              </button>
              <button
                type="button"
                className="m3-text-btn"
                style={{ padding: '4px 8px', fontSize: '0.85rem', minWidth: 'auto', color: '#666' }}
                onClick={() => setImportSelections(new Array(importCandidates.length).fill(false))}
              >
                □ 全解除
              </button>
            </div>
            {/* ▲▲▲ ここまで ▲▲▲ */}

            <div
              className="dialog-body"
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  (document.activeElement as HTMLElement)?.blur();
                }
              }}
            >
              {importCandidates.map((candidate, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0', borderBottom: '1px solid #e0e0e0' }}>
                  <input
                    type="checkbox"
                    style={{ transform: 'scale(1.5)', cursor: 'pointer' }}
                    checked={importSelections[idx]}
                    onChange={(e) => {
                      const newSelections = [...importSelections];
                      newSelections[idx] = e.target.checked;
                      setImportSelections(newSelections);
                    }}
                  />
                  <div style={{ flex: 1, fontSize: '1rem', fontWeight: 'bold', color: '#333' }}>
                    {candidate.parsedStyle.name}
                  </div>

                  {candidate.isOverwrite ? (
                    <span style={{ backgroundColor: '#ffebee', color: '#c62828', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                      {getString('overwriteBadge')}
                    </span>
                  ) : (
                    <span style={{ backgroundColor: '#e8f5e9', color: '#2e7d32', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                      {getString('addNewBadge')}
                    </span>
                  )}
                </div>
              ))}
            </div>

            <div className="dialog-footer">
              <button onClick={() => setShowImportDialog(false)} className="m3-text-btn" type="button">{getString('cancelBtn')}</button>
              <button onClick={executeImport} className="m3-filled-btn" type="button">{getString('importExecuteBtn')}</button>
            </div>
          </div>
        </div>
      )}

      {/* エクスポート選択ダイアログ */}
      {showExportDialog && (
        <div className="modal-overlay" onClick={() => setShowExportDialog(false)}>
          <div className="modal-content m3-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">
              <h2 style={{ margin: 0, fontSize: '1.4rem' }}>エクスポートするスタイル</h2>
            </div>

            <div style={{ display: 'flex', gap: '12px', padding: '0 24px', marginTop: '8px' }}>
              <button
                type="button"
                className="m3-text-btn"
                style={{ padding: '4px 8px', fontSize: '0.85rem', minWidth: 'auto', color: '#673ab7' }}
                onClick={() => setExportSelections(new Array(presets.length).fill(true))}
              >
                ✓ 全選択
              </button>
              <button
                type="button"
                className="m3-text-btn"
                style={{ padding: '4px 8px', fontSize: '0.85rem', minWidth: 'auto', color: '#666' }}
                onClick={() => setExportSelections(new Array(presets.length).fill(false))}
              >
                □ 全解除
              </button>
            </div>

            <div className="dialog-body">
              {presets.map((style, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0', borderBottom: '1px solid #e0e0e0' }}>
                  <input
                    type="checkbox"
                    style={{ transform: 'scale(1.5)', cursor: 'pointer' }}
                    checked={exportSelections[idx]}
                    onChange={(e) => {
                      const newSelections = [...exportSelections];
                      newSelections[idx] = e.target.checked;
                      setExportSelections(newSelections);
                    }}
                  />
                  <div style={{ flex: 1, fontSize: '1rem', fontWeight: 'bold', color: '#333' }}>
                    {style.name}
                  </div>
                </div>
              ))}
            </div>

            <div className="dialog-footer">
              <button onClick={() => setShowExportDialog(false)} className="m3-text-btn" type="button">キャンセル</button>
              <button onClick={executeExport} className="m3-filled-btn" type="button">エクスポート</button>
            </div>
          </div>
        </div>
      )}

      {/* 設定ダイアログ */}
      {showSettingsDialog && (
        <div className="modal-overlay" onClick={() => setShowSettingsDialog(false)}>
          <div className="modal-content m3-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">
              <h2 style={{ margin: 0, fontSize: '1.4rem' }}>{getString('settingsTitle')}</h2>
            </div>

            <div className="dialog-body">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>{getString('debugToggle')}</span>
                <input
                  type="checkbox"
                  checked={showDebug}
                  onChange={(e) => {
                    const isChecked = e.target.checked;
                    setShowDebug(isChecked);
                    if (isChecked) {
                      setShowSettingsDialog(false);
                    }
                  }}
                  style={{ transform: 'scale(1.5)' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                <button className="m3-filled-btn" style={{ flex: 1, background: '#f0edf5', color: '#111' }} onClick={openExportDialog} type="button">
                  {getString('exportBtn')}
                </button>
                <label className="m3-filled-btn" style={{ flex: 1, background: '#f0edf5', color: '#111', textAlign: 'center', cursor: 'pointer' }}>
                  {getString('importBtn')}
                  <input type="file" accept=".json" style={{ display: 'none' }} onChange={handleImportJson} />
                </label>
              </div>

              <button onClick={handleDeleteHistory} className="m3-filled-btn" style={{ marginTop: '16px', background: '#ffebee', color: '#c62828', width: '100%' }} type="button">
                {getString('deleteHistoryBtn')}
              </button>
            </div>

            <div className="dialog-footer">
              <button onClick={() => setShowSettingsDialog(false)} className="m3-text-btn" type="button">{getString('closeBtn')}</button>
            </div>
          </div>
        </div>
      )}

      {/* スタイル編集ダイアログ */}
      {showEditDialog && (
        <div className="modal-overlay" onClick={() => setShowEditDialog(false)}>
          <div className="modal-content m3-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">
              <h2 style={{ margin: 0, fontSize: '1.4rem' }}>{isAddingNew ? getString('styleNew') : getString('styleEdit')}</h2>
            </div>

            <div className="dialog-body" onClick={(e) => { if (e.target === e.currentTarget) (document.activeElement as HTMLElement)?.blur(); }}>
              <div className="m3-input-group"><label>{getString('styleName')}</label><input className="m3-input" value={editingStyle.name || ''} onChange={(e) => setEditingStyle({ ...editingStyle, name: e.target.value })} /></div>
              <div className="m3-row">
                <div className="m3-input-group flex-1">
                  <label>{getString('myLang')}</label><input className="m3-input" value={editingStyle.myLang || ''} onChange={(e) => setEditingStyle({ ...editingStyle, myLang: e.target.value })} />
                </div>
                <div className="m3-input-group flex-1">
                  <label>{getString('myLocale')}</label>
                  <select
                    className="m3-input m3-select"
                    value={editingStyle.myLocaleCode || ''}
                    onChange={e => setEditingStyle({ ...editingStyle, myLocaleCode: e.target.value })}
                  >
                    {supportedLocales.map(locale => (
                      <option key={locale.code} value={locale.code}>{locale.displayName}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="m3-row">
                <div className="m3-input-group flex-1">
                  <label>{getString('partnerLang')}</label><input className="m3-input" value={editingStyle.partnerLang || ''} onChange={(e) => setEditingStyle({ ...editingStyle, partnerLang: e.target.value })} />
                </div>
                <div className="m3-input-group flex-1">
                  <label>{getString('partnerLocale')}</label>
                  <select
                    className="m3-input m3-select"
                    value={editingStyle.partnerLocaleCode || ''}
                    onChange={e => setEditingStyle({ ...editingStyle, partnerLocaleCode: e.target.value })}
                  >
                    {supportedLocales.map(locale => (
                      <option key={locale.code} value={locale.code}>{locale.displayName}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="m3-row">
                <div className="m3-input-group flex-1">
                  <label>{getString('myGender')}</label><input className="m3-input" value={editingStyle.myGender || ''} onChange={(e) => setEditingStyle({ ...editingStyle, myGender: e.target.value })} />
                </div>
                <div className="m3-input-group flex-1">
                  <label>{getString('partnerGender')}</label><input className="m3-input" value={editingStyle.partnerGender || ''} onChange={(e) => setEditingStyle({ ...editingStyle, partnerGender: e.target.value })} />
                </div>
              </div>
              <div className="m3-input-group"><label>{getString('relationship')}</label><input className="m3-input" value={editingStyle.relationship || ''} onChange={(e) => setEditingStyle({ ...editingStyle, relationship: e.target.value })} /></div>
              <div className="m3-input-group"><label>{getString('baseTone')}</label><input className="m3-input" value={editingStyle.baseTone || ''} onChange={(e) => setEditingStyle({ ...editingStyle, baseTone: e.target.value })} /></div>

              <div className="m3-input-group"><label>{getString('voiceId')}</label>
                <select className="m3-input m3-select" value={editingStyle.voiceId || 'puck'} onChange={(e) => setEditingStyle({ ...editingStyle, voiceId: e.target.value })}>
                  {actingVoices.map(voice => (
                    <option key={voice.id} value={voice.id}>{voice.displayName}</option>
                  ))}
                </select>
              </div>

              <div className="m3-input-group"><label>{getString('pattern1')}</label><textarea className="m3-input" style={{ minHeight: '80px' }} value={editingStyle.pattern1 || ''} onChange={(e) => setEditingStyle({ ...editingStyle, pattern1: e.target.value })} /></div>
              <div className="m3-input-group"><label>{getString('pattern2')}</label><textarea className="m3-input" style={{ minHeight: '60px' }} value={editingStyle.pattern2 || ''} onChange={(e) => setEditingStyle({ ...editingStyle, pattern2: e.target.value })} /></div>
              <div className="m3-input-group"><label>{getString('pattern3')}</label><textarea className="m3-input" style={{ minHeight: '60px' }} value={editingStyle.pattern3 || ''} onChange={(e) => setEditingStyle({ ...editingStyle, pattern3: e.target.value })} /></div>
            </div>

            <div className="dialog-footer">
              <button onClick={() => setShowEditDialog(false)} className="m3-text-btn" type="button">
                {getString('cancelBtn')}
              </button>
              <button onClick={handleSaveStyle} className="m3-filled-btn" type="button">
                {getString('saveBtn')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ボイス選択モーダル（ネイティブ風リスト） */}
      {voiceSelectModalConfig?.isOpen && (
        <div className="modal-overlay" onClick={() => setVoiceSelectModalConfig(null)}>
          <div className="voice-modal-content" onClick={(e) => e.stopPropagation()}>
            {actingVoices.map(voice => {
              const isActive = getVoiceIdForBubble(voiceSelectModalConfig.ttsKey) === voice.id;
              return (
                <div
                  key={voice.id}
                  className={`voice-list-item ${isActive ? 'active' : ''}`}
                  onClick={() => {
                    setVoiceIdForBubble(voiceSelectModalConfig.ttsKey, voice.id);
                    setVoiceSelectModalConfig(null);
                  }}
                >
                  {voice.displayName}
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}

export default App;