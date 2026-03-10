// GeminiApi.ts
import { type ChatStylePreset } from './db';

export interface TranslationResult {
  trans: string;
  pron: string;
  intent: string;
  literal: string;
  partnerMsg?: string;
}

/**
 * Kotlin版: Locale.forLanguageTag(myLocaleCode).getDisplayLanguage(Locale.ENGLISH)
 * TS版では Intl.DisplayNames で近い挙動に寄せる
 */
const getIntentLangName = (localeCode?: string) => {
  try {
    const lc = (localeCode || '').trim();
    const langCode = (lc.includes('-') ? lc.split('-')[0] : lc) || 'en';
    const name = new Intl.DisplayNames(['en'], { type: 'language' }).of(langCode);
    return name?.trim() ? name : 'the base language of [MY_LANG]';
  } catch {
    return 'the base language of [MY_LANG]';
  }
};

export async function* streamGenerateContent(
  apiKey: string,
  prompt: string,
  systemInstruction: string | null = null,
  temperature: number = 0.7,
  maxOutputTokens: number = 600,
  onLog: (msg: string) => void
) {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=${apiKey}`;

  const body: any = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
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

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data:')) continue;

        if (isFirstChunk) {
          onLog(`⚡ [TTFT] 初回文字受信: ${Date.now() - startTime}ms`);
          isFirstChunk = false;
        }

        const dataStr = line.replace('data:', '').trim();
        if (!dataStr) continue;

        try {
          const jsonObj = JSON.parse(dataStr);
          const textChunk = jsonObj.candidates?.[0]?.content?.parts?.[0]?.text || '';
          if (textChunk) yield textChunk;
        } catch (e: any) {
          onLog(`⚠️ JSONパースエラー: ${e.message}`);
        }
      }
    }
  } catch (error: any) {
    onLog(`❌ [SSE Failure] Msg: ${error.message}`);
    throw error;
  }
}

/**
 * Kotlin版の Prompt 組み立てを Node/TS に忠実移植した版
 * - isMeSpeaking=false でも [TRANS] が「返信本文」
 * - [PARTNER_MSG] は「元INPUTの MY_LANG 翻訳」（Kotlinと同じ意味）
 * - user prompt に TAG INSTRUCTIONS / OUTPUT FORMAT / ANTI-LEAKAGE を含めて安定化
 * - systemInstruction も Kotlin同様に translator / assistant を切り替え
 */
export const runTranslation = async (
  apiKey: string,
  input: string,
  style: ChatStylePreset,
  isMeSpeaking: boolean,
  pattern: string,
  onLog: (msg: string) => void,
  onUpdate: (res: TranslationResult) => void
) => {
  const myLang = style.myLang?.trim() || 'Japanese';
  const partnerLang = style.partnerLang?.trim() || 'English';

  const myLocaleCode = style.myLocaleCode?.trim() || 'ja-JP';
  const partnerLocaleCode = style.partnerLocaleCode?.trim() || 'en-US';

  const myGenderVal = style.myGender?.trim() || 'Unspecified';
  const partnerGenderVal = style.partnerGender?.trim() || 'Unspecified';
  const relationVal = style.relationship?.trim() || 'Unspecified';
  const baseToneVal = style.baseTone?.trim() || 'Unspecified';

  const intentLangName = getIntentLangName(myLocaleCode);

  const actionText = isMeSpeaking
    ? 'TRANSLATE the [INPUT] text into [PARTNER_LANG].'
    : 'GENERATE A NATURAL REPLY to the [INPUT] in [PARTNER_LANG]. DO NOT copy the [INPUT].';

  // Kotlin版：相手発話モードのときだけ PARTNER_MSG を出力フォーマットに挿入
  const partnerMsgTag = !isMeSpeaking
    ? `[PARTNER_MSG] Translation of the original [INPUT] strictly in [MY_LANG]. Preserve the dialect/tone of [MY_LANG]. [/PARTNER_MSG]\n`
    : '';

  const singlePrompt = `
=== CONFIGURATION ===
[MY_LANG]: ${myLang}
[PARTNER_LANG]: ${partnerLang}
[NUANCE]: ${pattern}

=== YOUR MISSION ===
1. Read the [INPUT].
2. ${actionText}
3. Apply the [NUANCE].

=== TAG INSTRUCTIONS ===
* [TRANS] : The result in [PARTNER_LANG]. CRITICAL: Fully preserve any specified dialects, slang, or regional accents. Do NOT standardize. Use native characters, NO phonetic substitutions here.
* [PRON] : Phonetic guide of [TRANS] to help the [MY_LANG] speaker pronounce it. Auto-determine the system based on output locale (${partnerLocaleCode}) and reader's locale (${myLocaleCode}).
* [PARTNER_MSG] : Translation of [INPUT] strictly in [MY_LANG]. Preserve the dialect/tone of [MY_LANG].
* [INTENT] : Explanation of nuance/intent strictly in ${intentLangName}.
* [LITERAL] : Literal translation of [TRANS] strictly in [MY_LANG]. Preserve the dialect/tone of [MY_LANG].

* CRITICAL ANTI-LEAKAGE: The [NUANCE] instruction may be written in Japanese. You MUST completely ignore this and NEVER let Japanese leak into your output unless [MY_LANG] is Japanese. [INTENT] MUST be strictly in ${intentLangName}.
* CRITICAL: Do not invent or misspell tags.

=== OUTPUT FORMAT ===
[START]
[TRANS] ... [/TRANS]
[PRON] ... [/PRON]
${partnerMsgTag}[INTENT] ... [/INTENT]
[LITERAL] ... [/LITERAL]
[END]

[INPUT]
${input}
[/INPUT]
`.trim();

  const systemInstructionText = isMeSpeaking
    ? `
You are an expert bilingual translator.

=== CONTEXT ===
[MY_LANG]: ${myLang}
[PARTNER_LANG]: ${partnerLang}
[MY_GENDER]: ${myGenderVal}
[PARTNER_GENDER]: ${partnerGenderVal}
[RELATIONSHIP]: ${relationVal}
[BASE_TONE]: ${baseToneVal}

=== CORE RULES ===
1. Focus entirely on translating the [INPUT] into [PARTNER_LANG] strictly following the [NUANCE].
2. Always output using the exact [TAG]...[/TAG] format.
`.trim()
    : `
You are an expert conversational assistant.

=== CONTEXT ===
[MY_LANG]: ${myLang}
[PARTNER_LANG]: ${partnerLang}
[MY_GENDER]: ${myGenderVal}
[PARTNER_GENDER]: ${partnerGenderVal}
[RELATIONSHIP]: ${relationVal}
[BASE_TONE]: ${baseToneVal}

=== CORE RULES ===
1. Focus entirely on generating a natural reply to the [INPUT] in [PARTNER_LANG] strictly following the [NUANCE]. DO NOT copy the [INPUT].
2. Always output using the exact [TAG]...[/TAG] format.
`.trim();

  onLog(`📤 [送信プロンプト]\n${singlePrompt}\n---------------------------------`);
  onLog(`📎 [systemInstruction]\n${systemInstructionText}\n---------------------------------`);

  let streamedText = '';

  const extract = (tag: string) => {
    const startTag = `[${tag}]`;
    const endTag = `[/${tag}]`;
    const start = streamedText.indexOf(startTag);
    if (start === -1) return '';
    const end = streamedText.indexOf(endTag, start + startTag.length);
    if (end === -1) return streamedText.substring(start + startTag.length).trim();
    return streamedText.substring(start + startTag.length, end).trim();
  };

  for await (const chunk of streamGenerateContent(
    apiKey,
    singlePrompt,
    systemInstructionText,
    0.7,
    600,
    onLog
  )) {
    streamedText += chunk;

    onUpdate({
      trans: extract('TRANS'),
      pron: extract('PRON'),
      intent: extract('INTENT'),
      literal: extract('LITERAL'),
      partnerMsg: extract('PARTNER_MSG')
    });
  }
};
