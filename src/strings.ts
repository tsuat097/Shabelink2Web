const resources = {
  ja: {
    label_partner_msg: "【相手】",
    label_intent: "【意図】",
    label_literal: "【直訳】",
    label_generating: "⏳ AIが文脈を解析して思考中...",
    label_waiting: "...",
    label_role_me: "自分が話す",
    label_role_partner: "相手が話す",
    label_send: "翻訳・返答を生成",
    placeholder_input: "翻訳したい文章を入力...",
    settings_title: "設定",
    label_style_name: "スタイル名",
    label_my_gender: "自分の性別",
    label_partner_gender: "相手の性別",
    label_relationship: "二人の関係性 (例: 親友、恋人、上司と部下など)",
    label_base_tone: "ベースとなる口調 (例: 丁寧、タメ口、ツンデレ)",
    label_pattern1_required: "パターン1 (必須)",
    label_pattern2_optional: "パターン2 (任意)",
    label_pattern3_optional: "パターン3 (任意)"
  },
  en: {
    label_partner_msg: "[Partner]",
    label_intent: "[Intent]",
    label_literal: "[Literal]",
    label_generating: "⏳ AI is thinking...",
    label_waiting: "...",
    label_role_me: "I am speaking",
    label_role_partner: "Partner is speaking",
    label_send: "Translate / Generate",
    placeholder_input: "Enter text...",
    settings_title: "Settings",
    label_style_name: "Style Name",
    label_my_gender: "My Gender",
    label_partner_gender: "Partner Gender",
    label_relationship: "Relationship (e.g., Close friend, Boss)",
    label_base_tone: "Base Tone (e.g., Polite, Casual)",
    label_pattern1_required: "Pattern 1 (Required)",
    label_pattern2_optional: "Pattern 2 (Optional)",
    label_pattern3_optional: "Pattern 3 (Optional)"
  },
  zh: {
    label_partner_msg: "【对方】",
    label_intent: "【意图】",
    label_literal: "【直译】",
    label_generating: "⏳ AI 思考中...",
    label_waiting: "...",
    label_role_me: "我说话",
    label_role_partner: "对方说话",
    label_send: "翻译 / 生成回复",
    placeholder_input: "请输入内容...",
    settings_title: "设置",
    label_style_name: "样式名称",
    label_my_gender: "我的性别",
    label_partner_gender: "对方性别",
    label_relationship: "关系 (例：好友，上司)",
    label_base_tone: "基本语调 (例：礼貌，随便)",
    label_pattern1_required: "模式 1 (必填)",
    label_pattern2_optional: "模式 2 (选填)",
    label_pattern3_optional: "模式 3 (选填)"
  }
};

const getBrowserLang = (): keyof typeof resources => {
  const lang = navigator.language.split('-')[0];
  if (lang === 'ja' || lang === 'en' || lang === 'zh') {
    return lang as keyof typeof resources;
  }
  return 'en';
};

export const getString = (key: keyof typeof resources.ja): string => {
  const lang = getBrowserLang();
  return resources[lang][key] || resources.en[key];
};