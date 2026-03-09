import { useState, useCallback, useEffect } from 'react';
import { runTranslation, type TranslationResult } from './GeminiApi';
import { db, type ChatStylePreset, type ChatTurnEntity, type PhraseItem } from './db';
import { getString } from './strings';
import './App.css';

function App() {
  const [inputText, setInputText] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [isMeSpeaking, setIsMeSpeaking] = useState(true);
  const [apiKey] = useState(import.meta.env.VITE_GEMINI_API_KEY || '');
  
  const [streamingInput, setStreamingInput] = useState('');
  const [streamingIsMe, setStreamingIsMe] = useState(true);
  const [results, setResults] = useState<TranslationResult[]>([]);
  const [history, setHistory] = useState<ChatTurnEntity[]>([]);

  // --- スタイル管理・JSON入出力用 ---
  const [showSettings, setShowSettings] = useState(false);
  const [presets, setPresets] = useState<ChatStylePreset[]>([]);
  const [currentStyle, setCurrentStyle] = useState<ChatStylePreset | null>(null);

  const initDB = useCallback(async () => {
    let allStyles = await db.styles.toArray();
    // DBが空ならデフォルトのスタイルを1つ作成
    if (allStyles.length === 0) {
      const defaultStyle: ChatStylePreset = {
        name: "青島 (デフォルト)",
        myLang: "日本語", myLocaleCode: "ja-JP",
        partnerLang: "中国語", partnerLocaleCode: "zh-CN",
        baseTone: "自然で丁寧",
        pattern1: "丁寧・フォーマル", pattern2: "カジュアル・親しい", pattern3: "",
        myGender: "male", partnerGender: "female", relationship: "初対面", voiceId: "puck"
      };
      await db.styles.add(defaultStyle);
      allStyles = await db.styles.toArray();
    }
    setPresets(allStyles);
    setCurrentStyle(allStyles[0]);
  }, []);

  useEffect(() => { initDB(); }, [initDB]);

  useEffect(() => {
    if (currentStyle?.id) loadHistory(currentStyle.id);
  }, [currentStyle]);

  const loadHistory = async (styleId: number) => {
    const all = await db.history.toArray();
    const filtered = all.filter(h => h.styleId === styleId).sort((a, b) => b.timestamp - a.timestamp);
    setHistory(filtered);
  };

  const addLog = useCallback((msg: string) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 100));
  }, []);

  const clearInput = () => setInputText('');

  // 💡 JSON書き出し
  const handleExportJson = async () => {
    const allStyles = await db.styles.toArray();
    const blob = new Blob([JSON.stringify(allStyles, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'shabelink_styles.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 💡 JSON取り込み
  const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const json = JSON.parse(text) as ChatStylePreset[];
      if (Array.isArray(json)) {
        // IDの重複を避けるため、IDを削除して新規追加する
        const toImport = json.map(({ id, ...rest }) => rest);
        await db.styles.bulkAdd(toImport as any);
        await initDB();
        alert('スタイルをインポートしました！');
      }
    } catch (err: any) {
      alert('読み込みエラー: ' + err.message);
    }
  };

  const handleTranslate = async () => {
    if (!inputText || !apiKey || !currentStyle) return;

    const currentInput = inputText;
    const currentIsMe = isMeSpeaking;
    setStreamingInput(currentInput);
    setStreamingIsMe(currentIsMe);
    setInputText('');

    const activePatterns = [currentStyle.pattern1, currentStyle.pattern2, currentStyle.pattern3].filter(p => p && p.trim() !== '');
    setResults(activePatterns.map(() => ({ trans: '', pron: '', intent: '', literal: '' })));

    const tasks = activePatterns.map(async (pattern, index) => {
      let finalRes: TranslationResult = { trans: '', pron: '', intent: '', literal: '' };
      try {
        await runTranslation(apiKey, currentInput, currentStyle, currentIsMe, pattern, addLog, (res) => {
          finalRes = res;
          setResults(prev => { const next = [...prev]; next[index] = res; return next; });
        });
      } catch (e: any) { addLog(`❌ Error: ${e.message}`); }
      return finalRes;
    });
    
    const finalResults = await Promise.all(tasks);

    const suggestions: PhraseItem[] = finalResults.map(res => {
      const parts = [];
      if (res.partnerMsg && !currentIsMe) parts.push(`${getString('label_partner_msg')} ${res.partnerMsg}`);
      if (res.intent) parts.push(`${getString('label_intent')} ${res.intent}`);
      if (res.literal) parts.push(`${getString('label_literal')} ${res.literal}`);
      return { original: parts.join('\n'), pronunciation: res.pron, translated: res.trans };
    });

    try {
      await db.history.add({
        styleId: currentStyle.id || 1,
        input: currentInput,
        isMe: currentIsMe,
        suggestions: suggestions,
        timestamp: Date.now()
      });
    } catch (err: any) { addLog(`❌ DB Error: ${err.message}`); }

    setStreamingInput('');
    setResults([]);
    loadHistory(currentStyle.id!);
  };

  if (!currentStyle) return <div>Loading...</div>;

  return (
    <div className="app-container">
      <header className="top-bar">
        <h1>Shabelink2</h1>
        <button 
  className="icon-btn" 
  onClick={() => {
    console.log("⚙️ 歯車ボタンがクリックされました！ showSettingsをtrueにします");
    setShowSettings(true);
  }}
>
  ⚙️
</button>
      </header>

      <div className="scrollable-content">
        <section className="style-section">
          <div className="section-label">スタイル・方言設定</div>
          <div className="style-controls">
            <div className="style-dropdown" onClick={() => setShowSettings(true)}>
              <span>{currentStyle.name}</span>
              <span className="dropdown-arrow">▼</span>
            </div>
            <div className="style-actions">
              <button className="icon-btn" onClick={() => setShowSettings(true)}>✏️</button>
            </div>
          </div>
          <div className="lang-pair">
            {currentStyle.myLang} [{currentStyle.myLocaleCode}] ⇄ {currentStyle.partnerLang} [{currentStyle.partnerLocaleCode}]
          </div>
        </section>

        <section className="role-toggle-section">
          <span className={`role-label ${!isMeSpeaking ? 'active' : ''}`}>{getString('label_role_partner')}</span>
          {/* トグルスイッチ */}
          <div 
            className={`toggle-switch ${isMeSpeaking ? 'me' : 'partner'}`} 
            onClick={() => {
              console.log(`🔄 話者切り替え！ 現在: ${isMeSpeaking ? '自分' : '相手'} -> 変更後: ${!isMeSpeaking ? '自分' : '相手'}`);
              setIsMeSpeaking(!isMeSpeaking);
            }}
          >
            <div className="toggle-thumb" />
          </div>
          <span className={`role-label ${isMeSpeaking ? 'active' : ''}`}>{getString('label_role_me')}</span>
        </section>

        {/* 💡 isMeSpeaking で me / partner クラスが切り替わり、色が変わります */}
        <section className="input-section">
          <div className={`textarea-container ${isMeSpeaking ? 'me' : 'partner'}`}>
            <textarea 
              value={inputText} 
              onChange={(e) => setInputText(e.target.value)} 
              placeholder={`${isMeSpeaking ? currentStyle.myLang : currentStyle.partnerLang} で入力してください...`}
            />
            <span className="mic-icon">🎤</span>
          </div>
          
          <div className="input-tools">
            <button className="clear-btn" onClick={clearInput}>✕ 入力クリア</button>
            <div className="stt-toggles">
              <span className="stt-label">音声認識:</span>
              <button className="stt-btn active">端末 (高速)</button>
              <button className="stt-btn">AI (高精度)</button>
            </div>
          </div>
        </section>

        <button className="main-translate-btn" onClick={handleTranslate} disabled={!inputText}>
          {getString('label_send')}
        </button>

        <section className="results-area">
          {streamingInput && (
            <div className="history-turn">
              <div style={{ background: streamingIsMe ? '#e8f4f8' : '#e8f5e9', padding: '12px 16px', borderRadius: '12px', marginBottom: '12px', fontWeight: 'bold' }}>
                {streamingIsMe ? '自分' : '相手'}: {streamingInput}
              </div>
              {results.map((res, i) => (
                <div key={i} className="md3-card" style={{ marginBottom: '16px' }}>
                  <div className="card-badge">PATTERN {i + 1}</div>
                  <div className="card-trans">{res.trans || getString('label_generating')}</div>
                  {res.pron && <div className="card-pron">{res.pron}</div>}
                  {(res.partnerMsg || res.intent || res.literal) && (
                    <div className="card-details">
                      {res.partnerMsg && <div className="detail-line"><span className="detail-label">{getString('label_partner_msg')}</span> {res.partnerMsg}</div>}
                      {res.intent && <div className="detail-line"><span className="detail-label">{getString('label_intent')}</span> {res.intent}</div>}
                      {res.literal && <div className="detail-line literal-line"><span className="detail-label">{getString('label_literal')}</span> {res.literal}</div>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {history.map(turn => (
            <div key={turn.id} className="history-turn" style={{ marginTop: '12px', borderTop: '2px dashed #eee', paddingTop: '16px' }}>
              <div style={{ background: turn.isMe ? '#e8f4f8' : '#e8f5e9', padding: '12px 16px', borderRadius: '12px', marginBottom: '12px', fontWeight: 'bold', color: '#1a1a1a' }}>
                {turn.isMe ? '自分' : '相手'}: {turn.input}
              </div>
              {turn.suggestions.map((sug, i) => (
                <div key={i} className="md3-card" style={{ marginBottom: '16px' }}>
                  <div className="card-badge">PATTERN {i + 1}</div>
                  <div className="card-trans">{sug.translated}</div>
                  {sug.pronunciation && <div className="card-pron">{sug.pronunciation}</div>}
                  {sug.original && (
                    <div className="card-details">
                      {sug.original.split('\n').map((line, j) => (
                        <div key={j} className="detail-line">{line}</div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </section>

        {/* デバッグログ（非表示・削除禁止エリア） */}
        <details className="debug-collapsible" style={{ marginTop: '20px', padding: '10px', background: '#f0f0f0', borderRadius: '8px' }}>
          <summary style={{ cursor: 'pointer', fontSize: '0.8rem', color: '#555' }}>Debug Log (Click to view)</summary>
          <div className="debug-content" style={{ maxHeight: '200px', overflowY: 'auto', background: '#222', color: '#0f0', padding: '10px', fontSize: '0.75rem', marginTop: '10px' }}>
            {logs.map((log, i) => <div key={i} className="log-line">{log}</div>)}
          </div>
        </details>
      </div>

      {/* --- 設定・JSON入出力モーダル --- */}
      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">設定 / スタイル管理</div>
            
            <div className="settings-actions">
              <button className="settings-btn" onClick={handleExportJson}>ファイルへ保存</button>
              <label className="upload-btn">
                ファイルから追加
                <input type="file" accept=".json" onChange={handleImportJson} />
              </label>
            </div>

            <div style={{ fontWeight: 'bold', marginTop: '10px' }}>保存済みのスタイル</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {presets.map(preset => (
                <div key={preset.id} className="style-list-item">
                  <span>{preset.name}</span>
                  <button 
                    className="settings-btn" 
                    style={{ flex: 'none', padding: '6px 12px' }}
                    onClick={() => {
                      setCurrentStyle(preset);
                      setShowSettings(false);
                    }}
                  >
                    選択
                  </button>
                </div>
              ))}
            </div>

            <button className="close-modal-btn" onClick={() => setShowSettings(false)}>閉じる</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;