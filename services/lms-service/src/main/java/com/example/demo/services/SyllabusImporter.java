package com.example.demo.services;

import com.example.demo.models.SyllabusLevel;
import com.example.demo.models.SyllabusStage;
import com.example.demo.repositories.SyllabusLevelRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Service;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class SyllabusImporter implements CommandLineRunner {

    private final SyllabusLevelRepository levelRepository;

    public SyllabusImporter(SyllabusLevelRepository levelRepository) {
        this.levelRepository = levelRepository;
    }

    @Override
    public void run(String... args) throws Exception {
        System.out.println("[Syllabus Importer] Clearing and re-seeding syllabus database...");
        levelRepository.deleteAll();

        // Search for Document directory — relative to working dir (/app in Docker)
        File docDir = new File("Document");
        if (!docDir.exists()) {
            docDir = new File("../Document"); // fallback for local dev
        }

        System.out.println("[Syllabus Importer] Document directory resolved to: " + docDir.getAbsolutePath());

        // 1. Seed English from LISA_English_Curriculum.txt
        File engTxtFile = new File(docDir, "LISA_English_Curriculum.txt");
        if (engTxtFile.exists()) {
            try {
                importEnglishTxt(engTxtFile);
            } catch (Exception e) {
                System.err.println("[Syllabus Importer] Error importing English TXT: " + e.getMessage());
            }
        }

        // 2. Import other languages and ensure we have all 1 to 100 levels for English,
        // Chinese, Japanese
        ensureAllLevels("english");
        ensureAllLevels("chinese");
        ensureAllLevels("japanese");

        System.out.println("[Syllabus Importer] Seeding complete. Total levels in DB: " + levelRepository.count());
    }

    private void importEnglishTxt(File file) throws IOException {
        System.out.println("[Syllabus Importer] Parsing English syllabus file: " + file.getName());
        try (BufferedReader br = new BufferedReader(
                new InputStreamReader(new FileInputStream(file), StandardCharsets.UTF_8))) {
            String line;
            SyllabusLevel currentLevel = null;
            List<String> currentDetails = new ArrayList<>();

            Pattern levelPattern = Pattern.compile("LEVEL\\s*(\\d+)\\s*[–-]?\\s*(.*)",
                    Pattern.CASE_INSENSITIVE);
            Pattern stagePattern = Pattern.compile("(?:Sub-level|Sub level|\\bStage\\b)?\\s*(\\d+)\\s*[:\\.]\\s*(.*)",
                    Pattern.CASE_INSENSITIVE);

            while ((line = br.readLine()) != null) {
                line = line.trim();
                if (line.isEmpty() || line.startsWith("___"))
                    continue;

                // Check for new Level (using Unicode escapes for 🔵, 🔷, 🏆 to prevent compiler encoding issues)
                if (line.contains("LEVEL") && (line.contains("\uD83D\uDD35") || line.contains("\uD83D\uDD36") || line.contains("\uD83C\uDFC6"))) {
                    // Ignore range headers like "LEVELS 61-70" or lines containing plural "LEVELS"
                    if (line.toUpperCase().contains("LEVELS")) {
                        continue;
                    }
                    Matcher m = levelPattern.matcher(line.replace("\uD83D\uDD35", "").replace("\uD83D\uDD36", "").replace("\uD83C\uDFC6", "").trim());
                    if (m.find()) {
                        String levelNumStr = m.group(1);
                        // Check if it is a range (e.g. "61-70" or "61–70")
                        if (line.matches(".*\\b" + levelNumStr + "\\s*[–-]\\s*\\d+.*")) {
                            continue;
                        }

                        // Save previous level if existed
                        if (currentLevel != null) {
                            levelRepository.save(currentLevel);
                        }

                        int levelNum = Integer.parseInt(m.group(1));
                        String title = m.group(2).trim();
                        String cefr = levelNum <= 30 ? "A1-A2" : levelNum <= 60 ? "A2-B1" : "B1-B2";

                        currentLevel = SyllabusLevel.builder()
                                .language("english")
                                .levelNumber(levelNum)
                                .title(title)
                                .cefr(cefr)
                                .stages(new ArrayList<>())
                                .build();
                        currentDetails.clear();
                        continue;
                    }
                }

                // Check for stage (1 to 6)
                if (currentLevel != null) {
                    Matcher sm = stagePattern.matcher(line);
                    if (sm.find()) {
                        int stageNum = Integer.parseInt(sm.group(1));
                        String topic = sm.group(2).trim();

                        // Add stage to level
                        SyllabusStage stage = SyllabusStage.builder()
                                .stageNumber(stageNum)
                                .topic(topic)
                                .details("")
                                .syllabusLevel(currentLevel)
                                .build();
                        currentLevel.getStages().add(stage);
                    } else if (line.startsWith("•") || line.startsWith("-")) {
                        // Accumulate details/bullet points for stages
                        if (!currentLevel.getStages().isEmpty()) {
                            SyllabusStage lastStage = currentLevel.getStages().get(currentLevel.getStages().size() - 1);
                            String detail = lastStage.getDetails();
                            lastStage.setDetails(detail + (detail.isEmpty() ? "" : "\n") + line);
                        }
                    }
                }
            }

            // Save the last level
            if (currentLevel != null) {
                levelRepository.save(currentLevel);
            }
        }
    }

    private void ensureAllLevels(String language) {
        System.out.println("[Syllabus Importer] Checking levels 1-100 for language: " + language);

        for (int i = 1; i <= 100; i++) {
            Optional<SyllabusLevel> existing = levelRepository.findByLanguageAndLevelNumber(language, i);
            if (existing.isEmpty()) {
                String cefr = i <= 30 ? "A1-A2" : i <= 60 ? "A2-B1" : "B1-B2";
                String title = getMockLevelTitle(language, i);

                SyllabusLevel lvl = SyllabusLevel.builder()
                        .language(language)
                        .levelNumber(i)
                        .title(title)
                        .cefr(cefr)
                        .stages(new ArrayList<>())
                        .build();

                // Add 6 standard stages
                for (int s = 1; s <= 6; s++) {
                    String topic = getMockStageTopic(language, i, s);
                    String details = "Q1: Can you describe " + topic + "?\nQ2: What is your favorite thing about "
                            + topic + "?";
                    lvl.getStages().add(SyllabusStage.builder()
                            .stageNumber(s)
                            .topic(topic)
                            .details(details)
                            .syllabusLevel(lvl)
                            .build());
                }
                levelRepository.save(lvl);
            }
        }
    }

    private String getMockLevelTitle(String lang, int lvl) {
        if (lang.equals("chinese")) {
            if (lvl <= 30)
                return "中文初级沟通 (Level " + lvl + ")";
            if (lvl <= 60)
                return "中文中级表达 (Level " + lvl + ")";
            return "中文高级思辨 (Level " + lvl + ")";
        } else if (lang.equals("japanese")) {
            if (lvl <= 30)
                return "日本語初級会話 (Level " + lvl + ")";
            if (lvl <= 60)
                return "日本語中級会話 (Level " + lvl + ")";
            return "日本語上級ディスカッション (Level " + lvl + ")";
        } else {
            if (lvl <= 30)
                return "English Survival speaking (Level " + lvl + ")";
            if (lvl <= 60)
                return "English Intermediate Expressing (Level " + lvl + ")";
            return "English Advanced Debating (Level " + lvl + ")";
        }
    }

    private String getMockStageTopic(String lang, int lvl, int stage) {
        String prefix = "Stage " + stage + ": ";
        if (lang.equals("chinese")) {
            switch (stage) {
                case 1:
                    return prefix + "自我介绍与破冰 (Introductions)";
                case 2:
                    return prefix + "核心词汇与发音 (Key Words)";
                case 3:
                    return prefix + "场景句型练习 (Sentence Practice)";
                case 4:
                    return prefix + "自由表达讨论 (Free Speaking)";
                case 5:
                    return prefix + "AI辅助角色扮演 (Role Play)";
                default:
                    return prefix + "总结与互评 (Summary)";
            }
        } else if (lang.equals("japanese")) {
            switch (stage) {
                case 1:
                    return prefix + "自己紹介とアイスブレイク (Introductions)";
                case 2:
                    return prefix + "語彙とフレーズの発音 (Vocabulary)";
                case 3:
                    return prefix + "ロールプレイ練習 (Role Play)";
                case 4:
                    return prefix + "ディスカッション (Discussion)";
                case 5:
                    return prefix + "フィードバックと修正 (Feedback)";
                default:
                    return prefix + "今日のまとめ (Wrap-up)";
            }
        } else {
            switch (stage) {
                case 1:
                    return prefix + "Ice breaker & Warm-up";
                case 2:
                    return prefix + "Vocabulary builder";
                case 3:
                    return prefix + "Dialogue practice";
                case 4:
                    return prefix + "Extended speaking challenge";
                case 5:
                    return prefix + "AI evaluation prompts";
                default:
                    return prefix + "Stage review & Wrap-up";
            }
        }
    }
}
