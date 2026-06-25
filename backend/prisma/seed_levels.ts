import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const levelTitles = {
  EN: {
    BEGINNER: [
      'Greetings & Introductions', 'Numbers & Counting', 'Days & Months', 'Colors & Shapes', 'Family Members',
      'Food & Drinks', 'Clothing & Accessories', 'House & Home', 'Animals & Pets', 'Weather & Seasons',
      'Hobbies & Interests', 'Daily Routines', 'Time & Clock', 'Directions & Places', 'Body Parts',
      'Feelings & Emotions', 'Classroom Objects', 'Transportation', 'Jobs & Occupations', 'School Subjects',
      'Sports & Activities', 'Music & Instruments', 'Movies & Entertainment', 'City & Country', 'Shopping & Money',
      'Health & Body', 'Nature & Environment', 'Birthday & Celebrations', 'Friendship', 'Travel Basics',
    ],
    INTERMEDIATE: [
      'Past Tense Narration', 'Future Plans', 'Conditional Sentences', 'Passive Voice', 'Reported Speech',
      'Business Communication', 'Negotiation Skills', 'Presentation Skills', 'Email Writing', 'Meeting Vocabulary',
      'Marketing Basics', 'Financial Terms', 'HR & Recruitment', 'Project Management', 'Customer Service',
      'Travel & Tourism', 'Hotel & Hospitality', 'Restaurant Vocabulary', 'Recipe & Cooking', 'Health & Fitness',
      'Technology Terms', 'Social Media', 'Science & Research', 'Legal Vocabulary', 'Media & Journalism',
      'Environmental Issues', 'Political Terms', 'Art & Culture', 'Music Theory', 'Film & Theatre',
    ],
    ADVANCED: [
      'Abstract Concepts', 'Philosophical Discussion', 'Literary Analysis', 'Academic Writing', 'Research Methodology',
      'Critical Thinking', 'Debate Techniques', 'Rhetorical Devices', 'Persuasive Language', 'Formal Register',
      'Idioms & Collocations', 'Register Variation', 'Discourse Markers', 'Nuance & Connotation', 'Semantic Fields',
      'World Issues Discussion', 'Cross-cultural Communication', 'Diplomatic Language', 'International Relations',
      'Global Economics', 'Ethical Debates', 'Moral Philosophy', 'Social Psychology', 'Anthropology Terms',
      'Historical Analysis', 'Literary Criticism', 'Creative Writing', 'Public Speaking Mastery', 'Negotiation Expert',
    ],
  },
  ZH: {
    BEGINNER: [
      '你好世界', '数字一到十', '星期和月份', '颜色和形状', '家庭成员',
      '食物和饮料', '衣服和配饰', '房子和家', '动物和宠物', '天气和季节',
      '爱好和兴趣', '日常生活', '时间和钟表', '方向和地点', '身体部位',
      '感觉和情绪', '教室物品', '交通工具', '工作和职业', '学校科目',
      '运动和活动', '音乐和乐器', '电影和娱乐', '城市和国家', '购物和金钱',
      '健康和身体', '自然和环境', '生日和庆祝', '友谊', '旅行基础',
    ],
    INTERMEDIATE: [
      '过去式叙述', '未来计划', '条件句', '被动语态', '间接引语',
      '商务沟通', '谈判技巧', '演讲技巧', '邮件写作', '会议词汇',
      '市场营销基础', '金融术语', '人力资源', '项目管理', '客户服务',
      '旅游与酒店', '餐饮词汇', '食谱与烹饪', '健康与健身', '科技词汇',
      '社交媒体', '科学研究', '法律词汇', '媒体新闻', '环境问题',
      '政治术语', '艺术与文化', '音乐理论', '电影与戏剧', '国际贸易',
    ],
    ADVANCED: [
      '抽象概念', '哲学讨论', '文学分析', '学术写作', '研究方法',
      '批判性思维', '辩论技巧', '修辞手法', '说服语言', '正式语体',
      '成语和搭配', '语域变化', '话语标记', '细微差别', '语义场',
      '世界议题讨论', '跨文化沟通', '外交语言', '国际关系',
      '全球经济', '伦理辩论', '道德哲学', '社会心理学', '人类学术语',
      '历史分析', '文学批评', '创意写作', '演讲大师', '谈判专家',
    ],
  },
  JP: {
    BEGINNER: [
      'こんにちは世界', '数字と数え方', '曜日と月', '色と形', '家族',
      '食べ物と飲み物', '服と小物', '家と住宅', '動物とペット', '天気と季節',
      '趣味と興味', '日常生活', '時間と時計', '方向と場所', '体の部分',
      '感情と気分', '教室用品', '交通手段', '仕事と職業', '学校の科目',
      'スポーツと活動', '音楽と楽器', '映画と娯楽', '都市と国', '買い物とお金',
      '健康と体', '自然と環境', '誕生日と祝祭', '友情', '旅行の基礎',
    ],
    INTERMEDIATE: [
      '過去形の物語', '将来の計画', '条件文', '受動態', '間接話法',
      'ビジネス会話', '交渉スキル', 'プレゼンスキル', 'メール作成', '会議用語',
      'マーケティング基礎', '金融用語', '人事', 'プロジェクト管理', 'カスタマーサービス',
      '旅行と観光', 'ホテルとホスピタリティ', 'レストラン用語', 'レシピと料理', '健康とフィットネス',
      'テクノロジー用語', 'ソーシャルメディア', '科学と研究', '法律用語', 'メディアとジャーナリズム',
      '環境問題', '政治用語', 'アートと文化', '音楽理論', '映画と演劇',
    ],
    ADVANCED: [
      '抽象概念', '哲学的議論', '文学分析', '学術的作文', '研究方法論',
      '批判的思考', '弁論の技術', '修辞技法', '説得力のある言語', 'フォーマルな文体',
      'ことわざとコロケーション', '文体変化', '談話標識', 'ニュアンスと含意', '意味の分野',
      '世界の問題を議論する', '異文化コミュニケーション', '外交的言語', '国際関係',
      'グローバル経済', '倫理的な議論', '道徳哲学', '社会心理学', '人類学術語',
      '歴史分析', '文学批評', 'クリエイティブライティング', '公開弁論の達人', '交渉の専門家',
    ],
  },
};

const stageDurations: Record<string, number> = { BEGINNER: 60, INTERMEDIATE: 90, ADVANCED: 120 };

async function main() {
  let count = 0;
  for (const lang of ['EN', 'ZH', 'JP'] as const) {
    for (const stage of ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] as const) {
      const titles = levelTitles[lang][stage];
      for (let i = 0; i < titles.length; i++) {
        const levelNumber = i + 1 + (stage === 'INTERMEDIATE' ? 30 : stage === 'ADVANCED' ? 60 : 0);
        const subLevels = Array.from({ length: 4 }, (_, j) => ({
          index: j,
          title: `Segment ${j + 1}`,
          topics: [`Topic ${j * 3 + 1}`, `Topic ${j * 3 + 2}`, `Topic ${j * 3 + 3}`],
          durationMinutes: Math.round(stageDurations[stage] / 4),
        }));

        await prisma.level.upsert({
          where: { id: `lucy-${lang}-${levelNumber}` },
          update: {},
          create: {
            id: `lucy-${lang}-${levelNumber}`,
            language: lang,
            stage,
            levelNumber,
            title: titles[i],
            titleZh: lang === 'ZH' ? titles[i] : levelTitles.ZH[stage][i],
            titleJp: lang === 'JP' ? titles[i] : levelTitles.JP[stage][i],
            description: `${lang} ${stage.toLowerCase()} level ${levelNumber} - ${titles[i]}`,
            duration: stageDurations[stage],
            subLevels: JSON.stringify(subLevels),
          },
        });
        count++;
      }
    }
  }
  console.log(`✅ Seeded ${count} levels`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(e => { console.error(e); prisma.$disconnect(); process.exit(1); });
