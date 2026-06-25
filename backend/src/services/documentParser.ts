import fs from 'fs';
import path from 'path';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';

export interface ParsedLevel {
  levelNumber: number;
  title: string;
  titleZh?: string;
  titleJp?: string;
  description: string;
  duration: number;
  subLevels: SubLevel[];
}

export interface SubLevel {
  index: number;
  title: string;
  topics: string[];
  durationMinutes: number;
}

export interface ParseResult {
  success: boolean;
  levels: ParsedLevel[];
  errors: string[];
  rawText?: string;
}

const STAGE_RULES = [
  { name: 'BEGINNER', levelRange: [1, 30], duration: 60 },
  { name: 'INTERMEDIATE', levelRange: [31, 60], duration: 90 },
  { name: 'ADVANCED', levelRange: [61, 100], duration: 120 },
];

function detectLanguage(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.includes('chinese') || lower.includes('trung') || lower.includes('zh')) return 'ZH';
  if (lower.includes('japan') || lower.includes('nhật') || lower.includes('jp') || lower.includes('janp')) return 'JP';
  return 'EN';
}

function detectStage(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.includes('stage 1') || lower.includes('stage1') || lower.includes('1(1-30)') || lower.includes('sơ cấp') || /level[s]?\s*1[\s-]?30/i.test(lower)) return 'BEGINNER';
  if (lower.includes('stage 2') || lower.includes('stage2') || lower.includes('2(31-60)') || lower.includes('trung cấp') || /level[s]?\s*31[\s-]?60/i.test(lower)) return 'INTERMEDIATE';
  if (lower.includes('stage 3') || lower.includes('stage3') || lower.includes('3(61-100)') || lower.includes('cao cấp') || /level[s]?\s*61[\s-]?100/i.test(lower)) return 'ADVANCED';
  return 'BEGINNER';
}

function detectLevelNumberFromText(text: string, index: number, defaultLang: string): number {
  // Try to find level number from text
  const patterns = [
    /(?:level|lv|l)\s*[:.]?\s*(\d+)/gi,
    /(?:cấp|bậc|stage)\s*[:.]?\s*(\d+)/gi,
    /(\d+)\s*[:.]\s*[A-Za-z\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]/g,
  ];

  for (const pattern of patterns) {
    const matches = [...text.matchAll(pattern)];
    if (matches.length > index) {
      const num = parseInt(matches[index][1], 10);
      if (num >= 1 && num <= 100) return num;
    }
  }

  // Fallback: use index + 1
  return index + 1;
}

function extractLevelFromSection(section: string, index: number, stage: string, lang: string): ParsedLevel {
  const lines = section.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  let title = lines[0] || `Level ${index + 1}`;
  let description = lines.slice(1, 4).join(' ').substring(0, 300);
  const topics: string[] = [];

  // Extract bullet points and numbered items as topics
  const bulletPattern = /^[\-\*\•\d\.]+\s*(.+)/;
  for (const line of lines) {
    const match = line.match(bulletPattern);
    if (match && match[1].length > 3 && match[1].length < 200) {
      topics.push(match[1].trim());
    }
  }

  // Split into sub-levels (every ~3-5 topics = 1 sub-level, ~10-20 min each)
  const subLevels: SubLevel[] = [];
  const topicsPerSub = Math.max(3, Math.ceil(topics.length / 4));
  for (let i = 0; i < topics.length; i += topicsPerSub) {
    const chunk = topics.slice(i, i + topicsPerSub);
    subLevels.push({
      index: Math.floor(i / topicsPerSub),
      title: `Segment ${Math.floor(i / topicsPerSub) + 1}`,
      topics: chunk,
      durationMinutes: Math.round((chunk.length / topicsPerSub) * 15),
    });
  }

  const stageRule = STAGE_RULES.find(s => s.name === stage) || STAGE_RULES[0];

  return {
    levelNumber: index + stageRule.levelRange[0],
    title: title.substring(0, 100),
    titleZh: lang === 'ZH' ? title.substring(0, 100) : undefined,
    titleJp: lang === 'JP' ? title.substring(0, 100) : undefined,
    description: description || `Language learning session for ${stage.toLowerCase()} level`,
    duration: stageRule.duration,
    subLevels,
  };
}

function splitIntoSections(text: string): string[] {
  // Try various section splitting patterns
  const patterns = [
    /(?:^|\n)(?=(?:level|lv|l\s*\d|part\s*\d|cấp\s*\d|bậc\s*\d|chapter|unit|lesson)\s*[:.\-\d])/gim,
    /(?:\n){2,}/g,
    /(?:^|\n)(?=\d{1,2}[\s.]+(?:\w{3,}[A-Za-z\u4e00-\u9fff\u3040-\u309f]))/gm,
  ];

  for (const pattern of patterns) {
    const parts = text.split(pattern).filter(p => p.trim().length > 50);
    if (parts.length >= 3) {
      return parts;
    }
  }

  // Fallback: split by double newlines into chunks
  const chunks = text.split(/\n{2,}/).filter(c => c.trim().length > 100);
  if (chunks.length >= 3) return chunks;

  // Last resort: split by paragraphs
  const paragraphs = text.split(/\n/).filter(l => l.trim().length > 30);
  const sectionSize = Math.max(5, Math.floor(paragraphs.length / 10));
  const sections: string[] = [];
  for (let i = 0; i < paragraphs.length; i += sectionSize) {
    sections.push(paragraphs.slice(i, i + sectionSize).join('\n'));
  }

  return sections.length >= 3 ? sections : [text];
}

function cleanText(text: string): string {
  return text
    .replace(/[\r\n]+/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/[^\x20-\x7E\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af\n\-\*\•\d\.\:\;\,]/g, '')
    .trim();
}

export async function parseDocx(filePath: string, filename: string): Promise<ParseResult> {
  try {
    const buffer = fs.readFileSync(filePath);
    const result = await mammoth.extractRawText({ buffer });
    const text = cleanText(result.value);

    if (!text || text.length < 50) {
      return { success: false, levels: [], errors: ['Document appears to be empty or unreadable'] };
    }

    return parseTextContent(text, filename);
  } catch (err: any) {
    return { success: false, levels: [], errors: [`Failed to parse DOCX: ${err.message}`] };
  }
}

export async function parsePdf(filePath: string, filename: string): Promise<ParseResult> {
  try {
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    const text = cleanText(data.text);

    if (!text || text.length < 50) {
      return { success: false, levels: [], errors: ['PDF appears to be empty or unreadable'] };
    }

    return parseTextContent(text, filename);
  } catch (err: any) {
    return { success: false, levels: [], errors: [`Failed to parse PDF: ${err.message}`] };
  }
}

function parseTextContent(text: string, filename: string): ParseResult {
  const lang = detectLanguage(filename);
  const stage = detectStage(filename);
  const sections = splitIntoSections(text);

  const levels: ParsedLevel[] = [];
  const errors: string[] = [];

  for (let i = 0; i < sections.length && levels.length < 35; i++) {
    try {
      const section = sections[i].trim();
      if (section.length < 50) continue;

      const level = extractLevelFromSection(section, i, stage, lang);
      // Validate level number is within stage range
      const stageRule = STAGE_RULES.find(s => s.name === stage)!;
      if (level.levelNumber >= stageRule.levelRange[0] && level.levelNumber <= stageRule.levelRange[1]) {
        levels.push(level);
      }
    } catch (err: any) {
      errors.push(`Section ${i + 1}: ${err.message}`);
    }
  }

  // Ensure we have at least some levels
  if (levels.length === 0 && sections.length > 0) {
    const stageRule = STAGE_RULES.find(s => s.name === stage)!;
    for (let i = 0; i < Math.min(sections.length, 10); i++) {
      levels.push(extractLevelFromSection(sections[i], i, stage, lang));
      levels[i].levelNumber = stageRule.levelRange[0] + i;
    }
  }

  return { success: levels.length > 0, levels, errors, rawText: text.substring(0, 1000) };
}
