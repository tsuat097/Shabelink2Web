// src/GeminiApi.ts

// Android版の Flow<String> に相当する、非同期ジェネレーター関数（async function*）を使います
export async function* streamGenerateContent(
  apiKey: string,
  prompt: string,
  systemInstruction: string | null = null,
  temperature: number = 0.7,
  maxOutputTokens: number = 600,
  onLog: (msg: string) => void // デバッグログ出力用の関数（勝手に削除しません！）
) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=${apiKey}`;

  // Android版と同じ構成のJSONリクエストボディを作成
  const body: any = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
    ],
    generationConfig: {
      temperature,
      maxOutputTokens,
      thinkingConfig: { thinkingBudget: 0 }
    }
  };

  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] };
  }

  const startTime = Date.now();
  let isFirstChunk = true;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok || !response.body) {
      throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
    }

    // ストリーミングデータを読み込むためのリーダーを取得
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // 受信したバイナリデータを文字列に変換
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || ""; // 最後の不完全な行はバッファに残す

      for (const line of lines) {
        if (line.startsWith("data:")) {
          if (isFirstChunk) {
            onLog(`⚡ [TTFT] 初回文字受信: ${Date.now() - startTime}ms`);
            isFirstChunk = false;
          }

          const dataStr = line.replace("data:", "").trim();
          if (!dataStr) continue;

          try {
            const jsonObj = JSON.parse(dataStr);
            const textChunk = jsonObj.candidates?.[0]?.content?.parts?.[0]?.text || "";
            if (textChunk) {
              yield textChunk; // チャンクを呼び出し元に随時返す（ストリーミング）
            }
          } catch (e: any) {
            onLog(`⚠️ JSONパースエラー: ${e.message}`);
          }
        }
      }
    }
  } catch (error: any) {
    onLog(`❌ [SSE Failure] Msg: ${error.message}`);
    throw error;
  }
}