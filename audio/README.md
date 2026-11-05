# Afrikaans question audio

228 unique spoken prompts cover every current quiz question. The site serves these MP3 recordings directly; no speech service or API key is needed during playback.

Voice: Microsoft af-ZA-AdriNeural, rate -15%, generated using edge-tts 7.3.1. Text uses displayQ for clock questions so the time is not spoken aloud. Filenames are the first 20 hexadecimal characters of SHA-256 of the UTF-8 spoken text. AFRIKAANS_AUDIO in index.html maps spoken text to recordings.

When adding questions, generate recordings for any new spokenQuestion text and update the mapping. The test suite checks complete coverage. Native speech is a fallback only when an explicitly Afrikaans voice is available; English is never chosen as a fallback.
