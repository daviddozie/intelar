# Intelar Learning MVP Specification

## Purpose
Help Nigerian university students turn existing resources into
structured learning, practise their understanding, and continue
studying during internet interruptions.

## Pilot
- Audience: university students in Nigeria.
- Subject: introductory statistics.
- Language: English, with one human-reviewed French lesson.
- Delivery: mobile-friendly web application.
- Scope: one-week proof of concept.

## Existing foundation
Preserve Intelar's research chat, resources, authentication, and
workspaces. Extend the existing Next.js, Mastra, and LibSQL stack.

## Learning materials
Learners select existing resources or upload authorized materials.
Intelar prepares learning content from those sources.

The demonstration course uses selected OpenIntro Statistics material
with attribution and applicable licensing notices.

Generated content is labelled as AI-prepared. Demonstration lessons,
answers, calculations, and translations require human review.

## Required features
1. Create a study path from up to three authorized resources.
2. Review and edit an outline containing three to five lessons.
3. Read short lessons with examples and traceable source references.
4. Answer three multiple-choice questions per lesson.
5. Receive hints, answer explanations, and unlimited retries.
6. Save progress and resume after reloading.
7. Download lessons and practice for offline use.
8. Synchronize offline attempts without duplicates.
9. Complete one practical statistics activity.
10. View a next-step card connecting the skill to useful work.

## Demonstration course
- Data types.
- Mean and median.
- Measures of spread.
- Reading charts.
- Interpreting a small dataset.

Use synthetic campus transport costs in naira for the practical task.

## Experience
- Preserve existing light/dark themes and Geist typography.
- Add Learn navigation and a restrained teal accent.
- Prioritize Continue learning on the learning dashboard.
- Support 360 px screens, keyboard navigation, screen readers,
  visible focus, sufficient contrast, and reduced motion.
- Make the sample course readable without signing in.
- Require authentication for private paths and synchronized progress.
- Allow skipping, revisiting, and adjusting pace.

## Offline behavior
- Downloaded lessons, practice, feedback, and citations work offline.
- Live tutoring and research require connectivity.
- Target a text-only demo pack below 1 MB, excluding the app shell.
- Show download status and pending synchronization.
- Provide removal of downloaded data.
- Partition private storage by account and clear it on sign-out.

## Privacy and reliability
- Authorize every learning read and write using the server session.
- Validate generated source references before marking content ready.
- Preserve saved content during provider or database failures.
- Fix existing ownership and guest-retrieval gaps before learner trials.
- Use non-sensitive demo materials while upload privacy is unresolved.

## Deferred features
Facilitator authoring, cohort management, assignment grading,
notifications, full multilingual support, downloadable audio,
certification, and live opportunity listings.

## Definition of done
A learner can select resources, study a cited lesson, practise,
disconnect, continue offline, reconnect, and resume with correct
progress. Another account cannot access that learner's private data.