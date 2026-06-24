package com.example.demo.controllers;

import com.example.demo.models.SyllabusLevel;
import com.example.demo.models.SyllabusStage;
import com.example.demo.repositories.SyllabusLevelRepository;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;
import java.util.HashMap;
import java.util.Optional;

@RestController
@RequestMapping("/api/syllabus")
@CrossOrigin(origins = "*")
public class SyllabusController {

    private final SyllabusLevelRepository levelRepository;

    public SyllabusController(SyllabusLevelRepository levelRepository) {
        this.levelRepository = levelRepository;
    }

    @GetMapping("/levels")
    public List<SyllabusLevel> getLevels(@RequestParam(defaultValue = "english") String language) {
        return levelRepository.findByLanguage(language.toLowerCase());
    }

    @GetMapping("/current-question")
    public Map<String, String> getCurrentQuestion(
            @RequestParam(defaultValue = "english") String language,
            @RequestParam(defaultValue = "1") int level,
            @RequestParam(defaultValue = "1") int stage) {
        
        String topic = "Stage " + stage + " Topic (Not Found)";
        String details = "";
        String levelTitle = "";
        
        Optional<SyllabusLevel> syllabusLvl = levelRepository.findByLanguageAndLevelNumber(language.toLowerCase(), level);
        if (syllabusLvl.isPresent()) {
            levelTitle = syllabusLvl.get().getTitle();
            Optional<SyllabusStage> syllabusStage = syllabusLvl.get().getStages().stream()
                    .filter(s -> s.getStageNumber() == stage)
                    .findFirst();
            if (syllabusStage.isPresent()) {
                topic = syllabusStage.get().getTopic();
                details = syllabusStage.get().getDetails();
            }
        }
        
        Map<String, String> response = new HashMap<>();
        response.put("language", language);
        response.put("level", String.valueOf(level));
        response.put("levelTitle", levelTitle);
        response.put("stage", String.valueOf(stage));
        response.put("topic", topic);
        response.put("details", details);
        return response;
    }
}
