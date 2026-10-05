# Gluk Learning Implementation Plan

Read SPEC.md and AGENTS.md before implementation.
Preserve unrelated changes and existing functionality.

## Milestone 1: Establish a reliable foundation
- Configure a Node version compatible with installed dependencies.
- Verify Turso connectivity and diagnose any failures.
- Record baseline checks.
- Correct conversation ownership and guest retrieval gaps.
- Add compatible learning persistence.

Acceptance:
Existing chat and resources still work. Cross-account access is
rejected. Learning records can be saved and retrieved by their owner.

## Milestone 2: Prove the learning loop
- Add Learn navigation and the reviewed sample course.
- Build the lesson player and source references.
- Add practice, feedback, progress, and resume behavior.
- Add the practical activity and next-step card.

Acceptance:
A learner answers a question, reloads, and sees the saved result.
Lesson references resolve to their supporting materials.

## Milestone 3: Generate personal study paths
- Select up to three authorized resources.
- Prepare an editable outline.
- Generate source-grounded lessons and practice.
- Validate structure and source references.
- Add the focused lesson tutor.

Acceptance:
A learner creates a path from selected resources. Invalid references
and insufficient material produce clear errors. Failed generation
does not damage saved paths.

## Milestone 4: Support offline study
- Cache the application shell.
- Store versioned study packs in IndexedDB.
- Queue attempts using unique event IDs.
- Synchronize on reconnection.
- Implement account isolation and download removal.

Acceptance:
Downloaded lessons and practice work after an offline reload.
Repeated synchronization never duplicates an attempt.
Sign-out clears private offline content.

## Milestone 5: Validate the demonstration
- Review statistics content and one French lesson.
- Check mobile layouts and accessibility.
- Run the complete demonstration.
- Conduct trials with three to five students.
- Repair findings and prepare submission evidence.

Acceptance:
The full learning journey works. Student observations and remaining
limitations are documented honestly.

## Milestone 6: Exam Prep Simulation
- Create persistence tables `exam_preps` and `exam_attempts` with owner scoping.
- Implement exam question generator grounded in uploaded manuals/documents.
- Support difficulty levels (`easy`, `medium`, `hard`, `standard`).
- Support question counts (10, 20, 30, up to 50 threshold).
- Implement configurable exam timer with countdown and auto-submission.
- Build authentic exam player with question navigator and flag-for-review.
- Build post-exam score breakdown and question-by-question review with explanations.
- Add "Exam Prep" navigation to sidebar, Learn cross-link, and `/exam-prep` route.

Acceptance:
A learner uploads a course document/manual, configures difficulty (easy/medium/hard/standard), question count (10/20/30/50), and time limit. An authentic exam is generated and played under a countdown timer. Answers are graded, persisted, and reviewed with document-grounded explanations.

## Verification policy
- Run focused checks for authorization, persistence, generation
  validation, and offline synchronization.
- Run npx tsc --noEmit after relevant TypeScript changes.
- Run relevant lint checks during milestones.
- Run npm run lint and npm run build before final handoff.
- Record existing failures separately from regressions.
- Do not claim a check passed unless it was actually run.

## Execution policy
Update PROGRESS.md after each milestone.
Resolve routine implementation choices autonomously.
Record material decisions and their reasons.
Escalate missing information that genuinely blocks progress.
Keep postponed features outside this implementation.