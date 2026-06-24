package com.example.demo.models;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "syllabus_stages")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SyllabusStage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private int stageNumber; // 1 to 6

    @Column(nullable = false, length = 1000)
    private String topic;

    @Column(length = 2000)
    private String details;

    @ManyToOne
    @JoinColumn(name = "syllabus_level_id", nullable = false)
    @JsonIgnore
    private SyllabusLevel syllabusLevel;
}
