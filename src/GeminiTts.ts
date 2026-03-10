// src/GeminiTts.ts
export type TtsCallbacks = {
  onLog?: (msg: string) => void;
  onLoading?: () => void;
  onPlaying?: () => void;
  onDone?: () => void;
  onFallback?: () => void;
};

type SpeakArgs = {
  apiKey: string;
  text: string;
  style: string;   // Kotlinの "$style: $text" の style 部分
  voiceId: string; // puck/nova/...
  signal?: AbortSignal;
  callbacks?: TtsCallbacks;
};

const log = (cb: TtsCallbacks | undefined, msg: string) => cb?.onLog?.(msg);

function base64ToUint8Array(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function concatUint8Arrays(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

/**
 * PCM16LE mono 24000Hz を WebAudio で再生
 */
async function playPcm16Mono24k(pcmBytes: Uint8Array, cb?: TtsCallbacks) {
  // PCM16 = 2 bytes per sample
  if (pcmBytes.length < 2) return;

  const sampleRate = 24000;
  const sampleCount = Math.floor(pcmBytes.length / 2);

  // Int16LE -> Float32 (-1..1)
  const floats = new Float32Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    const lo = pcmBytes[i * 2];
    const hi = pcmBytes[i * 2 + 1];
    // signed 16bit
    let v = (hi << 8) | lo;
    if (v & 0x8000) v = v - 0x10000;
    floats[i] = Math.max(-1, Math.min(1, v / 32768));
  }

  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  const ctx: AudioContext = new AudioCtx({ sampleRate });

  const buffer = ctx.createBuffer(1, floats.length, sampleRate);
  buffer.copyToChannel(floats, 0);

  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.connect(ctx.destination);

  cb?.onPlaying?.();
  src.start();

  await new Promise<void>((resolve) => {
    src.onended = () => resolve();
  });

  try {
    await ctx.close();
  } catch {
    // ignore
  }
}

export async function speakWithGeminiTtsRest(args: SpeakArgs): Promise<void> {
  const { apiKey, text, style, voiceId, callbacks, signal } = args;

  const targetVoice = (voiceId || "puck").trim() || "puck";

  callbacks?.onLoading?.();

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:streamGenerateContent?alt=sse&key=${apiKey}`;

  const payload = {
    model: "gemini-2.5-flash-preview-tts",
    contents: [
      {
        parts: [{ text: `${style}: ${text}` }]
      }
    ],
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
    ],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: targetVoice }
        }
      }
    }
  };

  log(callbacks, `🌐 [送信] Gemini TTS Payload:\n${JSON.stringify(payload, null, 2)}`);

  let hasAudio = false;
  const audioChunks: Uint8Array[] = [];

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal,
    });

    if (!res.ok || !res.body) {
      const body = await res.text().catch(() => "");
      log(callbacks, `❌ [受信] TTS HTTP Error: ${res.status}\nBody: ${body}`);
      callbacks?.onFallback?.();
      callbacks?.onDone?.();
      return;
    }

    log(callbacks, "✅ [受信] TTS 接続成功。ストリーム受信待機中...");

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let chunkCount = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const dataStr = line.slice(5).trim();
        if (!dataStr) continue;

        try {
          const jsonObj = JSON.parse(dataStr);

          if (jsonObj.error) {
            const msg = jsonObj.error?.message || "Unknown error";
            log(callbacks, `❌ [APIエラー詳細] ${msg}`);
            continue;
          }

          const candidate = jsonObj.candidates?.[0];
          const finishReason = candidate?.finishReason;
          if (finishReason && finishReason !== "STOP") {
            log(callbacks, `⚠️ [生成停止理由] finishReason: ${finishReason}`);
          }

          const base64: string | undefined =
            candidate?.content?.parts?.[0]?.inlineData?.data;

          if (base64) {
            const bytes = base64ToUint8Array(base64);
            audioChunks.push(bytes);
            hasAudio = true;
            chunkCount++;
          }
        } catch (e: any) {
          log(callbacks, `⚠️ チャンク解析エラー: ${e.message}`);
        }
      }
    }

    log(callbacks, `✅ [受信] TTS ストリーム完了 (合計 ${chunkCount} チャンク受信)`);
  } catch (e: any) {
    log(callbacks, `❌ TTS 通信/処理エラー: ${e.message}`);
  } finally {
    try {
      if (!hasAudio) {
        log(callbacks, "⚠️ Gemini TTS で音声が取得できませんでした。");
        callbacks?.onFallback?.();
      } else {
        const pcm = concatUint8Arrays(audioChunks);
        await playPcm16Mono24k(pcm, callbacks);
      }
    } finally {
      callbacks?.onDone?.();
    }
  }
}
