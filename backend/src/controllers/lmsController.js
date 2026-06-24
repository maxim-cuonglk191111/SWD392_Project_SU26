/**
 * lmsController.js
 *
 * In-memory LMS content store — prototype only.
 * Production: replace with Java Spring LMS Service at LMS_SERVICE_URL.
 *
 * Content hierarchy:
 *   language  → stages[]  → levels[]  → topics[]
 *   "english"  → ["Sơ cấp", "Trung cấp", "Cao cấp"]
 *   Stage 1 (Sơ cấp):    1–34 levels  (Survival Speaking)
 *   Stage 2 (Trung cấp): 35–67 levels  (Practical Communication)
 *   Stage 3 (Cao cấp):   68–100 levels (Native Proficiency)
 *   Each level: 60–120 min room, subdivided into 6 sub-levels (≈10–20 min each)
 */

// ─── Seed data: 100 levels across 3 languages × 3 stages ─────────────────────
function seedLevels() {
  const STAGES = ['Sơ cấp', 'Trung cấp', 'Cao cấp'];
  const LANGUAGES = {
    english: {
      name: 'English',
      stages: STAGES.map((stage, si) => ({
        stage,
        stageIndex: si,
        levels: Array.from({ length: 34 }, (_, i) => {
          const levelNum = si * 34 + i + 1;
          return {
            level: levelNum,
            title: getEnglishTitle(levelNum),
            description: getEnglishDesc(levelNum),
            duration: '60–90 min',
            topics: getEnglishTopics(levelNum),
          };
        }),
      })),
    },
    chinese: {
      name: '中文',
      stages: STAGES.map((stage, si) => ({
        stage,
        stageIndex: si,
        levels: Array.from({ length: 34 }, (_, i) => {
          const levelNum = si * 34 + i + 1;
          return {
            level: levelNum,
            title: getChineseTitle(levelNum),
            description: getChineseDesc(levelNum),
            duration: '60–90 min',
            topics: getChineseTopics(levelNum),
          };
        }),
      })),
    },
    japanese: {
      name: '日本語',
      stages: STAGES.map((stage, si) => ({
        stage,
        stageIndex: si,
        levels: Array.from({ length: 34 }, (_, i) => {
          const levelNum = si * 34 + i + 1;
          return {
            level: levelNum,
            title: getJapaneseTitle(levelNum),
            description: getJapaneseDesc(levelNum),
            duration: '60–90 min',
            topics: getJapaneseTopics(levelNum),
          };
        }),
      })),
    },
  };
  return LANGUAGES;
}

function getEnglishTitle(n) {
  const t = [
    'Self Introduction & Greetings', 'Numbers & Phone Numbers', 'Days & Months', 'Colors & Shapes',
    'Family Members', 'Food & Drinks', 'Clothing & Sizes', 'Hobbies & Interests',
    'Daily Routines', 'Weather & Seasons', 'Time & Schedule', 'Asking Directions',
    'Shopping & Prices', 'Restaurant Orders', 'Travel & Transportation', 'School & Education',
    'Jobs & Professions', 'Health & Body', 'City & Country Life', 'Festivals & Holidays',
    'Music & Movies', 'Sports & Fitness', 'News & Media', 'Technology & Internet',
    'Environment & Nature', 'Money & Banking', 'Law & Rights', 'Science & Innovation',
    'Philosophy & Ideas', 'Literature & Arts', 'History & Geography', 'Global Issues',
    'Cultural Diversity', 'Expert Debate & Rhetoric',
  ];
  const idx = (n - 1) % 34;
  return `Level ${n}: ${t[idx] || 'Advanced Topic'} ${n > 34 ? '(II)' : n > 67 ? '(III)' : ''}`.trim();
}

function getEnglishDesc(n) {
  if (n <= 34) return 'Basic survival vocabulary and sentence patterns. Build confidence in everyday conversations.';
  if (n <= 67) return 'Practical communication in real-world contexts. Express opinions and handle complex situations.';
  return 'Native-level fluency. Engage in nuanced debates, professional discussions, and cultural analysis.';
}

function getEnglishTopics(n) {
  const base = (n - 1) % 34;
  return [
    { subLevel: 1, topic: 'Vocabulary & Key Phrases', duration: '10 min' },
    { subLevel: 2, topic: 'Dialogue Practice', duration: '15 min' },
    { subLevel: 3, topic: 'Role Play Scenario', duration: '20 min' },
    { subLevel: 4, topic: 'Free Discussion', duration: '15 min' },
    { subLevel: 5, topic: 'Pronunciation Drill', duration: '10 min' },
    { subLevel: 6, topic: 'Wrap-up & Q&A', duration: '10 min' },
  ];
}

function getChineseTitle(n) {
  const t = [
    '问候与自我介绍', '数字与时间', '家庭与关系', '饮食与餐厅',
    '购物与价格', '交通与出行', '天气与季节', '工作与职业',
    '学校与教育', '兴趣爱好', '日常生活', '城市与乡村',
    '节日与习俗', '健康与身体', '媒体与娱乐', '科技与网络',
    '环境与自然', '金融与消费', '法律与权利', '科学与创新',
    '哲学与思想', '文学与艺术', '历史与地理', '国际事务',
    '文化多样性', '专业辩论', '商务谈判', '跨文化交流',
    '高端演讲', '诗词鉴赏', '新闻分析', '政策讨论',
    '社会热点', '专家圆桌',
  ];
  const idx = (n - 1) % 34;
  return `Level ${n}: ${t[idx] || '高级主题'} ${n > 34 ? '（中级）' : n > 67 ? '（高级）' : ''}`.trim();
}

function getChineseDesc(n) {
  if (n <= 34) return '基础生存汉语。掌握日常交际用语，建立学习信心。';
  if (n <= 67) return '实用口语交流。在真实场景中表达观点，处理复杂情境。';
  return '母语级流利度。参与深度辩论、专业讨论与跨文化分析。';
}

function getChineseTopics(n) {
  return [
    { subLevel: 1, topic: '词汇与常用语', duration: '10 分钟' },
    { subLevel: 2, topic: '情景对话练习', duration: '15 分钟' },
    { subLevel: 3, topic: '角色扮演', duration: '20 分钟' },
    { subLevel: 4, topic: '自由讨论', duration: '15 分钟' },
    { subLevel: 5, topic: '语音纠正', duration: '10 分钟' },
    { subLevel: 6, topic: '总结与问答', duration: '10 分钟' },
  ];
}

function getJapaneseTitle(n) {
  const t = [
    '自己紹介と挨拶', '数と時間', '家族と関係', '食事とレストラン',
    '買い物と価格', '交通手段', '天気と季節', '仕事と職業',
    '学校と教育', '趣味と関心事', '日常生活', '都市と地方',
    '行事と習慣', '健康と体', 'メディアと娯楽', '科技とネット',
    '環境と自然', '金融と消費', '法律と権利', '科学と革新',
    '哲学と思想', '文学と芸術', '歴史と地理', '国際問題',
    '文化の多様性', '専門的な議論', 'ビジネス交渉', '異文化コミュニケーション',
    '高端演讲', '詩歌鑑賞', 'ニュース分析', '政策討論',
    '社会のホットトピック', '専門家パネル',
  ];
  const idx = (n - 1) % 34;
  return `Level ${n}: ${t[idx] || '高度な話題'} ${n > 34 ? '（中級）' : n > 67 ? '（上級）' : ''}`.trim();
}

function getJapaneseDesc(n) {
  if (n <= 34) return '初級会話。日常生活の基本表現を習得し、自信をつける。';
  if (n <= 67) return '中級实用会話。様々な場面での意見表現と状況対応。';
  return '上級ネイティブ级别。深度ある議論、专业的讨论、異文化分析に参加。';
}

function getJapaneseTopics(n) {
  return [
    { subLevel: 1, topic: '語彙と基本フレーズ', duration: '10 分' },
    { subLevel: 2, topic: '会話練習', duration: '15 分' },
    { subLevel: 3, topic: 'ロールプレイ', duration: '20 分' },
    { subLevel: 4, topic: '自由討論', duration: '15 分' },
    { subLevel: 5, topic: '発音トレーニング', duration: '10 分' },
    { subLevel: 6, topic: 'まとめとQ&A', duration: '10 分' },
  ];
}

// ─── Singleton content store ───────────────────────────────────────────────────
const CONTENT = seedLevels();

// ─── GET /api/lms/languages ───────────────────────────────────────────────────
async function getLanguages(req, res) {
  const result = Object.entries(CONTENT).map(([key, val]) => ({
    code: key,
    name: val.name,
    stageCount: val.stages.length,
    levelCount: val.stages.reduce((s, st) => s + st.levels.length, 0),
  }));
  return res.json({ languages: result });
}

// ─── GET /api/lms/content/:language ─────────────────────────────────────────
async function getLanguageContent(req, res) {
  const { language } = req.params;
  const lang = CONTENT[language.toLowerCase()];
  if (!lang) return res.status(404).json({ error: `Language '${language}' not found` });
  return res.json(lang);
}

// ─── GET /api/lms/level/:language/:level ─────────────────────────────────────
async function getLevel(req, res) {
  const { language, level } = req.params;
  const lang = CONTENT[language.toLowerCase()];
  if (!lang) return res.status(404).json({ error: `Language '${language}' not found` });

  const n = parseInt(level);
  if (!n || n < 1 || n > 100) return res.status(400).json({ error: 'level must be 1–100' });

  for (const stage of lang.stages) {
    const lvl = stage.levels.find(l => l.level === n);
    if (lvl) return res.json({ ...lvl, stage: stage.stage, stageIndex: stage.stageIndex, language: lang.name });
  }

  return res.status(404).json({ error: `Level ${n} not found` });
}

// ─── GET /api/lms/stage/:language/:stageIndex ─────────────────────────────────
async function getStage(req, res) {
  const { language, stageIndex } = req.params;
  const lang = CONTENT[language.toLowerCase()];
  if (!lang) return res.status(404).json({ error: `Language '${language}' not found` });

  const si = parseInt(stageIndex);
  if (si < 0 || si >= lang.stages.length) return res.status(400).json({ error: 'Invalid stage index' });

  return res.json(lang.stages[si]);
}

// ─── GET /api/lms/search ───────────────────────────────────────────────────────
async function searchContent(req, res) {
  const { q, language, stage } = req.query;
  if (!q) return res.status(400).json({ error: 'q (query) is required' });

  const results = [];
  const query = q.toLowerCase();

  const langs = language ? [CONTENT[language.toLowerCase()]].filter(Boolean) : Object.values(CONTENT);

  for (const lang of langs) {
    for (const st of lang.stages) {
      if (stage !== undefined && st.stageIndex !== parseInt(stage)) continue;
      for (const lvl of st.levels) {
        const inTitle = lvl.title.toLowerCase().includes(query);
        const inDesc = lvl.description.toLowerCase().includes(query);
        const inTopic = lvl.topics.some(t => t.topic.toLowerCase().includes(query));
        if (inTitle || inDesc || inTopic) {
          results.push({ ...lvl, stage: st.stage, stageIndex: st.stageIndex, language: lang.name, matchOn: inTitle ? 'title' : inTopic ? 'topic' : 'description' });
        }
      }
    }
  }

  return res.json({ query: q, total: results.length, results: results.slice(0, 20) });
}

// ─── GET /api/lms/ai-suggestions/:language/:level ────────────────────────────
async function getAiSuggestions(req, res) {
  const { language, level } = req.params;
  const lang = CONTENT[language.toLowerCase()];
  if (!lang) return res.status(404).json({ error: `Language '${language}' not found` });

  const n = parseInt(level);
  let targetLevel = lang.stages[0].levels[0];
  for (const st of lang.stages) {
    const lvl = st.levels.find(l => l.level === n);
    if (lvl) { targetLevel = lvl; break; }
  }

  const suggestions = [
    `Prepare 3–5 questions about "${targetLevel.topics[0]?.topic || targetLevel.title}" to ask the group`,
    `Think of a personal story related to ${targetLevel.title}`,
    `Review key vocabulary: prepare definitions for any unknown words`,
    `Practice the target sentence patterns out loud before the session`,
    `Consider asking a native speaker to correct your pronunciation on these phrases`,
  ];

  return res.json({ level: n, language: lang.name, suggestions });
}

module.exports = { getLanguages, getLanguageContent, getLevel, getStage, searchContent, getAiSuggestions };
