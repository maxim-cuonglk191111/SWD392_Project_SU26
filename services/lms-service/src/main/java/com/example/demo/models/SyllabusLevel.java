package com.example.demo.models;

import jakarta.persistence.*;
import lombok.*;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "syllabus_levels", uniqueConstraints = {
        @UniqueConstraint(columnNames = { "language", "levelNumber" })
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SyllabusLevel {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String language; // "english", "chinese", "japanese"

    @Column(nullable = false)
    private int levelNumber; // 1 to 100

    private String title;

    private String cefr; // A1, A2, B1, B2

    @OneToMany(mappedBy = "syllabusLevel", cascade = CascadeType.ALL, fetch = FetchType.EAGER)
    @Builder.Default
    private List<SyllabusStage> stages = new ArrayList<>();
}
