# DIG-25 spike: Sarvam streaming speech-to-text

Run on 17 Nov 2026 with `api/scripts/spike-sarvam/run.ts`. All clips are synthetic consult dictation, with no patients and no names.

## Decision

**Go with Sarvam, with adjustments:** use `saaras:v4` on the realtime WebSocket with `language_code=auto`, `mode=codemix` and `stream_type=fast`, **without a shared `keyterms` list**. Updated 17 Nov after the first real recordings: a shared term list inserted gastro terms into an eye consult. See "Real recordings" below.

Before Sprint 3, re-run the script on clips spoken by the doctors themselves. The clips here are TTS audio: clean, steady and noise-free, so these numbers are a best case.

## Setup

- Endpoint: `wss://api.sarvam.ai/speech-to-text-realtime/ws`, linear16 PCM at 16 kHz mono. Audio was streamed in real time in 100 ms chunks, the way a phone microphone would send it.
- Clips: Sarvam TTS (`bulbul:v3`), one per language plus one that switches between Hindi and English mid-sentence. The 5 clips are 11–15 s each, about 1 minute in total.
- **First word** is the time from the first audio chunk to the first non-empty partial transcript. **Tail** is the time from the last audio chunk to the last final transcript.
- **WER** compares words after lower-casing and removing punctuation. It counts `40` against "forty" and Latin `LFT` against Devanagari `एलएफटी` as errors, so the WER on Indic clips is mostly formatting, not misrecognition (see the transcripts below).

## Results

| Config                                          | First word, median (range) | Medical terms correct | Real misrecognitions                                                              |
| ----------------------------------------------- | -------------------------- | --------------------- | --------------------------------------------------------------------------------- |
| `saaras:v3-realtime`, fixed language            | 2.1 s (1.2–4.1)            | 17/19                 | timolol → "इमोलॉल" (mr); "Ursodoxicolic" (en); "महिमे" for "महिने" (gu, not a term) |
| `saaras:v4`, fixed language                     | 2.3 s (2.0–4.1)            | 18/19                 | timolol → "इमोलॉल" (mr)                                                           |
| `saaras:v4` + keyterms                          | 2.1 s (1.4–4.0)            | 18/19                 | timolol → "इमोलॉल" (mr)                                                           |
| `saaras:v4` + keyterms, auto, **codemix**       | 2.1 s (2.1–2.2)            | **19/19**             | none                                                                              |
| `saaras:v4` + keyterms, auto, codemix, **fast** | **1.2 s (0.7–2.1)**        | **19/19**             | none                                                                              |

I judged the term counts by hand. Spelling variants of a correct word count as correct: `एल.एफ.टी.`, `आयओ पी`, `ટીમોલોલ`, `अर्सोडॉक्सीकॉलिक`. The script's automatic term check accepts only the spellings listed in `clips.ts`, so its table is stricter than this one. In fixed-language modes, Indic transcripts write English terms in native script, with spellings that vary from run to run. That alone is a reason to use codemix.

Tail latency (end of speech to final text) was 0.6–1.7 s in every config. Each config ran once per clip, so the latency numbers are indicative, not statistical.

**Language detection:** with `auto`, every clip was detected correctly (`hi-IN`, `mr-IN`, `gu-IN`, `en-IN`), including the mixed clip.

### Medical terms (best config: codemix + fast)

| Term                 | en  | hi         | mr  | gu  | mixed |
| -------------------- | --- | ---------- | --- | --- | ----- |
| LFT / ALT / OGD      | ✅  | ✅ (Latin) | –   | –   | ✅    |
| IOP / fundus         | –   | –          | ✅  | ✅  | –     |
| pantoprazole         | ✅  | ✅         | –   | –   | –     |
| ursodeoxycholic acid | ✅  | –          | –   | –   | ✅    |
| timolol              | –   | –          | ✅  | ✅  | –     |

Codemix writes English medical words in Latin script inside Indic sentences, for example `रुग्णाच्या डाव्या डोळ्याचा IOP 22 आहे`. That is what structuring and Rx matching need: drug names and abbreviations come out in a single spelling, whatever language the doctor speaks.

### Transcripts (codemix + fast)

- **en:** Patient complains of epigastric pain for two weeks. LFT shows raised ALT of ninety-four. Plan OGD next week. Start pantoprazole forty milligrams once daily before breakfast and ursodeoxycholic acid three hundred milligrams twice a day.
- **hi:** मरीज़ को 2 हफ़्ते से पेट के ऊपरी हिस्से में दर्द है। LFT में ALT बढ़ा हुआ है। अगले हफ़्ते OGD करवाएंगे। Pantoprazole 40 mg रोज़ सुबह नाश्ते से पहले लेना है।
- **mr:** रुग्णाच्या डाव्या डोळ्याचा IOP 22 आहे. fundus तपासणीत cup disc ratio वाढलेला आहे. timolol डोळ्यात दिवसातून दोन वेळा घालावे. एक महिन्यानंतर पुन्हा तपासणी.
- **gu:** દર્દીની જમણી આંખમાં ઝાંખું દેખાય છે. IOP 18 છે. fundus સામાન્ય છે. મોતિયાનું operation આવતા મહિને કરીશું. timolol દિવસમાં 2 વાર નાખવું.
- **mixed:** Patient को तीन दिन से fever है, LFT normal है, but ultrasound में fatty liver दिखा, so start ursodeoxycholic acid 300 mg twice daily और OGD next week करेंगे।

## Adjustments for Sprint 3 (dictation relay)

1. **Connection settings:** `model=saaras:v4`, `language_code=auto`, `mode=codemix`, `stream_type=fast`. Auto plus codemix also handles a doctor switching language mid-consult without a language picker.
2. **Term list: off by default.** A shared list made real transcripts worse (see "Real recordings"). If a term list is added later, make it per doctor and small, and keep it only if it improves the doctors' own recorded clips. Don't add it on the assumption that it helps.
3. **Numbers:** the transcript mixes digits and words ("ninety-four", "40 mg"). Structuring (Bedrock) should normalise doses and lab values. Don't rely on the speech-to-text output format.
4. **Fallback:** keep per-field dictation and confirm-before-save as the safety net. Everything AI-filled is unconfirmed until the doctor confirms it.
5. **Usage:** bill per second from `session.end.audio_duration_s` and write it to `usage_events`.

## Real recordings (17 Nov 2026)

Both doctors recorded made-up consults as WhatsApp voice notes on a phone (no real patients; "Mr. X", "Mrs. Y"). They were converted with `afconvert` and transcribed with `run.ts --file`, with and without the shared term list. Full transcripts and the doctors' checks are in `DIG-25-real-clips-review.md`.

| #   | Doctor     | Clip                                             | Detected | First word               | Without term list                    | With shared term list                      |
| --- | ---------- | ------------------------------------------------ | -------- | ------------------------ | ------------------------------------ | ------------------------------------------ |
| 1   | Samradnyee | Cataract, English, 65 s                          | en-IN ✅ | 2.6 s                    | very good                            | "liver function test" → "LFT"              |
| 2   | Samradnyee | Cataract, Marathi + English, 35 s                | mr-IN ✅ | 4.5 s (silence at start) | "Operation", "CBC" ✅                | "OGD", "LFT, ALT" ❌                       |
| 3   | Samradnyee | Allergic conjunctivitis, English + Marathi, 78 s | mr-IN ✅ | 2.4 s                    | 2 errors: olopatadine, meibography ¹ | same drug error; meibography → "fundus" ❌ |
| 4   | Saiyam     | Oesophageal cancer follow-up, English, 95 s      | en-IN ✅ | 3.8 s                    | 2 small slips ²                      | same                                       |
| 5   | Saiyam     | Lap cholecystectomy follow-up, English, 41 s     | en-IN ✅ | 2.6 s                    | "SOS basis" ✅, confirmed fine       | "as as basis" ❌                           |

¹ Confirmed by Dr. Samradnyee: "olopatadine" → "Ola Patadine", "meibography" → "mammography". Otherwise "caught it well".
² Confirmed by Dr. Saiyam: "in six months" for "since six months", and an extra "in" after "malignancy". "Rest all seems fine."

- Real phone audio works in English and in Marathi–English, with no language picker. English medical words come out in Latin script.
- **The shared term list made every difference worse.** It replaced words the doctor said with words from the list (OGD, LFT, ALT, fundus) or broke a common one ("SOS").
- **Rare drug and test names are the weak spot** (olopatadine, meibography). Structuring must match them against the clinic's drug and test lists and flag low-confidence matches for the doctor to confirm.
- Restarts and repeated phrases in natural speech come through as spoken, so structuring has to tidy them up.
- **Doctors want concise note-style output** (Dr. Saiyam): "Loss of weight, significant loss of weight around 8 kgs in the last 2-3 months" should read "Significant weight loss of 8 kg in the last 2–3 months". That's a structuring requirement (DIG-59): rewrite into short clinical phrasing without changing facts, and keep the verbatim transcript beside the note.

Still needed: a Hindi or Gujarati clip and one switching language mid-sentence, plus the OnePlus recording.

## Cost

About 5 minutes of audio were streamed in total, which costs about ₹2.40 at ₹0.49 per minute (pay-as-you-go, excluding GST). TTS for the clips was under ₹2. A 10-minute dictated consult would cost about ₹5.

## Still to do (before Sprint 3)

- Record the 5 scripts in `clips.ts` spoken by a person (a doctor, ideally), as 16 kHz mono WAV, over a real phone mic with clinic background noise. Save them as `api/scripts/spike-sarvam/out/audio/<clipId>.wav` and re-run the script. It uses those files instead of generating TTS.
- Try a long, rambling dictation (2–3 min) to check utterance splitting and the inactivity timeout (close code 1008: send a ping while paused).

## How to re-run

```bash
pnpm --filter api exec tsx scripts/spike-sarvam/run.ts            # all clips, all configs
pnpm --filter api exec tsx scripts/spike-sarvam/run.ts --only mr-eye --config v4
```

The key is read from Secrets Manager (`swasthyaiq-dev/app`) or `SARVAM_API_KEY`, and is never printed. Output goes to `api/scripts/spike-sarvam/out/`, which is git-ignored.
