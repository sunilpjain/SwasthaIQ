/**
 * DIG-25 spike: Sarvam streaming speech-to-text on synthetic consult clips.
 *
 *   pnpm --filter api exec tsx scripts/spike-sarvam/run.ts [--only <clipId>] [--config <name>] [--fresh-audio]
 *
 * 1. Makes each clip with Sarvam TTS (16 kHz mono WAV), cached in out/audio/.
 * 2. Streams the PCM in real time (100 ms chunks) to the realtime STT WebSocket,
 *    once per config in CONFIGS.
 * 3. Measures first-word latency (first audio sent -> first non-empty partial),
 *    tail latency (last audio sent -> last final), WER and medical-term hits.
 * Writes out/results.json and prints a Markdown table.
 *
 * The API key comes from SARVAM_API_KEY or Secrets Manager (swasthyaiq-dev/app) and
 * is never printed or written. Clips are synthetic: no patients, no names.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import WebSocket from 'ws';
import { CLIPS, KEYTERMS, type Clip } from './clips';

const OUT = join(__dirname, 'out');
const AUDIO = join(OUT, 'audio');
const SAMPLE_RATE = 16000;
const CHUNK_MS = 100;
const BYTES_PER_CHUNK = (SAMPLE_RATE * 2 * CHUNK_MS) / 1000;
const STT_URL = 'wss://api.sarvam.ai/speech-to-text-realtime/ws';
const RUPEES_PER_MIN = 0.49; // pay-as-you-go streaming STT, excl. GST

interface SttConfig {
  name: string;
  streamType?: 'fast' | 'balanced';
  model: 'saaras:v3-realtime' | 'saaras:v4';
  /** 'clip' = the clip's own language; 'auto' = Sarvam detects it. */
  language: 'clip' | 'auto';
  mode?: 'transcribe' | 'codemix';
  keyterms?: boolean;
}

const CONFIGS: SttConfig[] = [
  { name: 'v3-realtime', model: 'saaras:v3-realtime', language: 'clip' },
  { name: 'v4', model: 'saaras:v4', language: 'clip' },
  { name: 'v4+keyterms', model: 'saaras:v4', language: 'clip', keyterms: true },
  { name: 'v4+keyterms auto codemix', model: 'saaras:v4', language: 'auto', mode: 'codemix', keyterms: true },
  {
    name: 'v4+keyterms auto codemix fast',
    model: 'saaras:v4',
    language: 'auto',
    mode: 'codemix',
    keyterms: true,
    streamType: 'fast',
  },
];

interface RunResult {
  clip: string;
  language: string;
  mixed: boolean;
  config: string;
  audioS: number;
  firstWordMs: number | null;
  tailMs: number | null;
  transcript: string;
  detectedLanguage: string | null;
  wer: number;
  termsHit: string[];
  termsMissed: string[];
  error: string | null;
}

async function apiKey(): Promise<string> {
  if (process.env.SARVAM_API_KEY) return process.env.SARVAM_API_KEY;
  const sm = new SecretsManagerClient({ region: 'ap-south-1' });
  const res = await sm.send(new GetSecretValueCommand({ SecretId: 'swasthyaiq-dev/app' }));
  const key = (JSON.parse(res.SecretString ?? '{}') as { sarvamApiKey?: string }).sarvamApiKey;
  if (!key || key === 'SET-ME') throw new Error('sarvamApiKey is not set in swasthyaiq-dev/app');
  return key;
}

async function tts(clip: Clip, key: string, fresh: boolean): Promise<Buffer> {
  const file = join(AUDIO, `${clip.id}.wav`);
  if (!fresh && existsSync(file)) return readFileSync(file);
  const res = await fetch('https://api.sarvam.ai/text-to-speech', {
    method: 'POST',
    headers: { 'api-subscription-key': key, 'content-type': 'application/json' },
    body: JSON.stringify({
      text: clip.text,
      language_code: clip.ttsLanguage,
      model: 'bulbul:v3',
      speech_sample_rate: SAMPLE_RATE,
      output_audio_codec: 'wav',
    }),
  });
  if (!res.ok) throw new Error(`TTS ${clip.id}: HTTP ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { audios: string[] };
  const wav = Buffer.from(body.audios.join(''), 'base64');
  writeFileSync(file, wav);
  return wav;
}

/** Returns raw 16-bit mono PCM from a WAV, checking the format. */
function pcmFromWav(wav: Buffer): Buffer {
  let off = 12;
  let fmtOk = false;
  while (off + 8 <= wav.length) {
    const id = wav.toString('ascii', off, off + 4);
    const size = wav.readUInt32LE(off + 4);
    const body = off + 8;
    if (id === 'fmt ') {
      const channels = wav.readUInt16LE(body + 2);
      const rate = wav.readUInt32LE(body + 4);
      const bits = wav.readUInt16LE(body + 14);
      if (channels !== 1 || rate !== SAMPLE_RATE || bits !== 16) {
        throw new Error(`unexpected WAV format: ${channels} ch, ${rate} Hz, ${bits} bit`);
      }
      fmtOk = true;
    }
    if (id === 'data') {
      if (!fmtOk) throw new Error('WAV data chunk before fmt chunk');
      // Some encoders write 0 or 0xFFFFFFFF as a streaming placeholder size.
      const end = size === 0 || size === 0xffffffff ? wav.length : Math.min(body + size, wav.length);
      return wav.subarray(body, end);
    }
    off = body + size + (size % 2);
  }
  throw new Error('no data chunk in WAV');
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface StreamResult {
  transcript: string;
  detected: string | null;
  error: string | null;
  firstWordMs: number | null;
  tailMs: number | null;
}

async function stream(pcm: Buffer, clip: Clip, cfg: SttConfig, key: string): Promise<StreamResult> {
  const params = new URLSearchParams({
    model: cfg.model,
    language_code: cfg.language === 'auto' ? 'auto' : clip.language,
    sample_rate: String(SAMPLE_RATE),
    encoding: 'linear16',
  });
  if (cfg.mode) params.set('mode', cfg.mode);
  if (cfg.streamType) params.set('stream_type', cfg.streamType);
  if (cfg.keyterms) params.set('keyterms', JSON.stringify(KEYTERMS));

  const ws = new WebSocket(`${STT_URL}?${params}`, { headers: { 'API-SUBSCRIPTION-KEY': key } });
  const finals = new Map<number, string>();
  let firstAudioAt = 0;
  let lastAudioAt = 0;
  let firstWordAt: number | null = null;
  let lastFinalAt: number | null = null;
  let detected: string | null = null;
  let error: string | null = null;

  const closed = new Promise<void>((resolve) => {
    ws.on('close', (code, reason) => {
      if (code !== 1000 && code !== 1005 && !error) error = `closed ${code} ${reason.toString()}`;
      resolve();
    });
    ws.on('error', (e) => {
      error = error ?? `ws error: ${e.message}`;
    });
  });

  ws.on('message', (raw) => {
    const now = performance.now();
    const m = JSON.parse(raw.toString()) as Record<string, unknown>;
    const ev = m.event as string | undefined;
    if (ev === 'transcript.partial' || ev === 'transcript.final') {
      const text = String(m.text ?? '').trim();
      if (text && firstWordAt === null && firstAudioAt) firstWordAt = now;
      if (typeof m.language === 'string') detected = m.language;
      if (ev === 'transcript.final') {
        finals.set(Number(m.utterance_idx ?? finals.size), text);
        lastFinalAt = now;
      }
    } else if (ev === 'error') {
      error = `${String(m.code)}: ${String(m.message)}`;
    } else if (ev === 'session.end') {
      ws.close(1000);
    }
  });

  await new Promise<void>((resolve, reject) => {
    ws.once('open', () => resolve());
    ws.once('error', reject);
    ws.once('unexpected-response', (_req, res) => reject(new Error(`HTTP ${res.statusCode} on connect`)));
  });

  // Real-time pacing: one 100 ms chunk every 100 ms, like a phone mic.
  const start = performance.now();
  for (let i = 0, n = 0; i < pcm.length; i += BYTES_PER_CHUNK, n++) {
    if (ws.readyState !== WebSocket.OPEN) break;
    const chunk = pcm.subarray(i, i + BYTES_PER_CHUNK);
    ws.send(JSON.stringify({ event: 'audio_input', audio: chunk.toString('base64') }));
    if (n === 0) firstAudioAt = performance.now();
    lastAudioAt = performance.now();
    const due = start + (n + 1) * CHUNK_MS;
    await sleep(Math.max(0, due - performance.now()));
  }
  // ~1 s of silence lets VAD close the last utterance before we end.
  for (let s = 0; s < 10 && ws.readyState === WebSocket.OPEN; s++) {
    ws.send(
      JSON.stringify({ event: 'audio_input', audio: Buffer.alloc(BYTES_PER_CHUNK).toString('base64') }),
    );
    await sleep(CHUNK_MS);
  }
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ event: 'end' }));
  const timeout = setTimeout(() => ws.terminate(), 15000);
  await closed;
  clearTimeout(timeout);

  const transcript = [...finals.entries()]
    .sort((a, b) => a[0] - b[0])
    .map((e) => e[1])
    .join(' ');
  return {
    transcript,
    detected,
    error,
    firstWordMs: firstWordAt !== null ? Math.round(firstWordAt - firstAudioAt) : null,
    tailMs: lastFinalAt !== null ? Math.round(lastFinalAt - lastAudioAt) : null,
  };
}

/** Lowercase, NFC, strip punctuation and symbols (incl. danda) for WER. */
function words(s: string): string[] {
  return s
    .normalize('NFC')
    .toLowerCase()
    .replace(/[\p{P}\p{S}।॥]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function wer(ref: string, hyp: string): number {
  const r = words(ref);
  const h = words(hyp);
  if (r.length === 0) return h.length === 0 ? 0 : 1;
  let prev = Array.from({ length: h.length + 1 }, (_, j) => j);
  for (let i = 1; i <= r.length; i++) {
    const cur = [i];
    for (let j = 1; j <= h.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (r[i - 1] === h[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[h.length] / r.length;
}

function termCheck(clip: Clip, transcript: string) {
  // v4 writes acronyms as "एल.एफ.टी." — dots are formatting, not a recognition error.
  const t = transcript.normalize('NFC').toLowerCase().replace(/\./g, '');
  const hit: string[] = [];
  const missed: string[] = [];
  for (const term of clip.terms) {
    (term.accept.some((a) => t.includes(a.normalize('NFC').toLowerCase())) ? hit : missed).push(term.label);
  }
  return { hit, missed };
}

async function main() {
  const args = process.argv.slice(2);
  const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : undefined;
  const fresh = args.includes('--fresh-audio');
  const onlyConfig = args.includes('--config') ? args[args.indexOf('--config') + 1] : undefined;
  mkdirSync(AUDIO, { recursive: true });
  const key = await apiKey();
  const clips = CLIPS.filter((c) => !only || c.id === only);
  const results: RunResult[] = [];

  for (const clip of clips) {
    const pcm = pcmFromWav(await tts(clip, key, fresh));
    const audioS = pcm.length / (SAMPLE_RATE * 2);
    for (const cfg of CONFIGS.filter((c) => !onlyConfig || c.name === onlyConfig)) {
      process.stdout.write(`${clip.id} / ${cfg.name} (${audioS.toFixed(1)} s) ... `);
      let r: StreamResult;
      try {
        r = await stream(pcm, clip, cfg, key);
      } catch (e) {
        r = { transcript: '', detected: null, error: (e as Error).message, firstWordMs: null, tailMs: null };
      }
      const terms = termCheck(clip, r.transcript);
      const row: RunResult = {
        clip: clip.id,
        language: clip.language,
        mixed: clip.mixed,
        config: cfg.name,
        audioS: Number(audioS.toFixed(1)),
        firstWordMs: r.firstWordMs,
        tailMs: r.tailMs,
        transcript: r.transcript,
        detectedLanguage: r.detected,
        wer: Number(wer(clip.text, r.transcript).toFixed(2)),
        termsHit: terms.hit,
        termsMissed: terms.missed,
        error: r.error,
      };
      results.push(row);
      process.stdout.write(
        r.error ? `ERROR ${r.error}\n` : `WER ${row.wer}, first word ${row.firstWordMs} ms\n`,
      );
      await sleep(1500); // space out connections (burst opens can be rejected with 1003)
    }
  }

  writeFileSync(join(OUT, 'results.json'), JSON.stringify(results, null, 2));
  const totalS = results.reduce((s, r) => s + r.audioS, 0);
  const lines = [
    '| Clip | Config | Audio s | First word ms | Tail ms | WER | Terms hit | Missed |',
    '|---|---|---|---|---|---|---|---|',
    ...results.map(
      (r) =>
        `| ${r.clip} | ${r.config} | ${r.audioS} | ${r.firstWordMs ?? '–'} | ${r.tailMs ?? '–'} | ${r.error ? 'error' : r.wer} | ` +
        `${r.termsHit.length}/${r.termsHit.length + r.termsMissed.length} | ${r.termsMissed.join(', ') || '–'} |`,
    ),
    '',
    `Streamed ${(totalS / 60).toFixed(1)} min of audio ≈ ₹${((totalS / 60) * RUPEES_PER_MIN).toFixed(2)} at ₹${RUPEES_PER_MIN}/min.`,
  ];
  console.log(`\n${lines.join('\n')}`);
}

main().catch((e: unknown) => {
  console.error((e as Error).message);
  process.exit(1);
});
