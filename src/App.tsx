// src/App.tsx
import { useState } from 'react';
import { ThemeProvider, createTheme, CssBaseline, AppBar, Toolbar, Typography, Container, Box, TextField, Button, Paper, Switch, FormControlLabel} from '@mui/material';
import { streamGenerateContent } from './GeminiApi';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#6750A4' },
    secondary: { main: '#625B71' },
    background: { default: '#F4EFF4' }
  },
});

function App() {
   const [apiKey, setApiKey] = useState(import.meta.env.VITE_GEMINI_API_KEY ||'');
  const [inputText, setInputText] = useState('');
  const [showDebug, setShowDebug] = useState(false);
  const [debugLog, setDebugLog] = useState("--- Debug Log Started ---\n");
  
  // ★追加：チャット履歴を保持するステート
  const [chatHistory, setChatHistory] = useState<{ role: 'me' | 'partner', text: string }[]>([]);

  const updateLog = (msg: string) => {
    setDebugLog(prev => prev + msg + "\n");
    console.log(msg);
  };

  const handleSend = async () => {
    if (!inputText.trim()) return;
    if (!apiKey) {
      alert("Gemini API Keyを入力してください！");
      return;
    }

    const currentInput = inputText;
    updateLog(`送信: ${currentInput}`);
    setInputText(''); // 入力欄をクリア

    // 1. 自分の発言を履歴に追加
    setChatHistory(prev => [...prev, { role: 'me', text: currentInput }]);
    
    // 2. 相手（AI）の返答枠を空っぽで作成
    setChatHistory(prev => [...prev, { role: 'partner', text: '⏳ 翻訳中...' }]);

    try {
      // ※まずはシンプルなプロンプトでテストします
      const prompt = `以下の日本語を英語に翻訳してください。\n\n[INPUT]\n${currentInput}\n[/INPUT]`;
      
      const stream = streamGenerateContent(
        apiKey,
        prompt,
        "You are an expert bilingual translator.",
        0.7,
        600,
        updateLog
      );

      let streamedText = "";
      // 3. ストリーミングで文字が届くたびに画面を更新
      for await (const chunk of stream) {
        streamedText += chunk;
        setChatHistory(prev => {
          const newHistory = [...prev];
          // 一番最後のメッセージ（AIの返答枠）のテキストを書き換える
          newHistory[newHistory.length - 1].text = streamedText;
          return newHistory;
        });
      }
      updateLog("✅ [完了] 受信完了しました。");

    } catch (error: any) {
      updateLog(`❌ エラー発生: ${error.message}`);
      setChatHistory(prev => {
        const newHistory = [...prev];
        newHistory[newHistory.length - 1].text = "通信エラーが発生しました。デバッグログを確認してください。";
        return newHistory;
      });
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppBar position="static" elevation={0}>
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 'bold' }}>
            Shabelink2
          </Typography>
          <FormControlLabel
            control={<Switch color="default" checked={showDebug} onChange={(e) => setShowDebug(e.target.checked)} />}
            label={<Typography variant="caption">デバッグ</Typography>}
          />
        </Toolbar>
      </AppBar>

      <Container maxWidth="md" sx={{ mt: 2, mb: 2, display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)' }}>
        <Box sx={{ mb: 2 }}>
          <TextField
            fullWidth label="Gemini API Key" type="password" size="small"
            value={apiKey} onChange={(e) => setApiKey(e.target.value)}
          />
        </Box>

        {/* ★変更：チャット履歴の表示エリア */}
        <Paper sx={{ flexGrow: 1, p: 2, mb: 2, overflowY: 'auto', borderRadius: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {chatHistory.length === 0 ? (
            <Typography variant="body2" color="textSecondary" align="center" sx={{ mt: 4 }}>
              メッセージを入力すると、ここに翻訳結果が表示されます。
            </Typography>
          ) : (
            chatHistory.map((msg, index) => (
              <Box key={index} sx={{ alignSelf: msg.role === 'me' ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
                <Typography variant="caption" color="textSecondary" sx={{ ml: 1 }}>
                  {msg.role === 'me' ? 'あなた' : 'Gemini'}
                </Typography>
                <Paper elevation={1} sx={{ p: 1.5, borderRadius: 2, bgcolor: msg.role === 'me' ? '#E8DEF8' : '#FFFFFF' }}>
                  <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>{msg.text}</Typography>
                </Paper>
              </Box>
            ))
          )}
        </Paper>

        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            fullWidth variant="outlined" placeholder="メッセージを入力..."
            value={inputText} onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <Button variant="contained" onClick={handleSend} sx={{ borderRadius: 2 }}>
            送信
          </Button>
        </Box>

        {showDebug && (
          <Paper sx={{ mt: 2, p: 2, bgcolor: '#1e1e1e', color: '#4caf50', maxHeight: '200px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '12px' }}>
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{debugLog}</pre>
            <Button size="small" variant="outlined" color="inherit" onClick={() => setDebugLog("--- Log Cleared ---\n")} sx={{ mt: 1 }}>
              ログクリア
            </Button>
          </Paper>
        )}
      </Container>
    </ThemeProvider>
  );
}

export default App;