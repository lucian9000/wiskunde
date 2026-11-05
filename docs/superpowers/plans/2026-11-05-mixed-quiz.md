# Mixed Grade 2 quiz implementation plan

Goal: Extend the existing Afrikaans quiz with Gemeng, Vorms, Maal, Deel and Tyd, in 20-question rounds.

Architecture: Retain the static page, styling, Afrikaans read-aloud, history storage key and review flow. Reuse the archived shape/time bank, complete study-sheet coverage, and add similar questions. Stable question IDs and per-subject shuffled queues persist in separate local storage. Mixed rounds draw five per subject; focused rounds draw twenty. No duplicates within a round, including a cycle boundary. Exhaust a subject before starting its next shuffled cycle. Storage failures fall back to memory.

- [ ] Add failing tests for source coverage, balanced mixed rounds, focused rounds, cycle boundaries, reload persistence, corrupt/unavailable storage, and existing review/score behavior.
- [ ] Extend index.html with all shape facts, numbered clock illustrations, time examples, and the subject selector. Keep all 130 arithmetic sums.
- [ ] Implement shared subject rotation queues and protect new rounds from callbacks belonging to an old round.
- [ ] Run node --test tests/quiz.test.cjs and git diff --check. Inspect desktop/mobile browser flow and correct versus incorrect answer review.
- [ ] Push verified changes to the existing GitHub main deployment path and verify the production commit and live quiz.

Content: Match the supplied school conventions for curved sides/surfaces. Qualify 12-hour day/night as the study-sheet model; ordinary years have 365 days. Include all eight 3D objects and their corner/edge/face counts, five 2D shapes, ten time facts, minute-hand positions, and all pictured daily events and elapsed intervals.
