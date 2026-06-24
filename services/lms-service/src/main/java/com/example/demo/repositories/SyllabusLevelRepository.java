package com.example.demo.repositories;

import com.example.demo.models.SyllabusLevel;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;
import java.util.List;

@Repository
public interface SyllabusLevelRepository extends JpaRepository<SyllabusLevel, Long> {
    Optional<SyllabusLevel> findByLanguageAndLevelNumber(String language, int levelNumber);
    List<SyllabusLevel> findByLanguage(String language);
}
