/**
 * DIG-23 spike: Bedrock (Claude) structuring + image reading, and Textract tables, from Mumbai.
 *
 *   pnpm --filter api exec tsx scripts/spike-bedrock/run.ts [--textract-only]
 *
 * Uses the AnthropicBedrock (InvokeModel) client: the Bedrock "Mantle" Messages endpoint
 * returns 404 for every Claude model in ap-south-1 (checked 17 Nov 2026).
 * Claude in ap-south-1 is reachable only through inference profiles:
 *   in.*     -> routes within India (ap-south-1, ap-south-2)
 *   global.* -> may route to any commercial region
 * Synthetic data only (CLAUDE.md). Prints ids, timings, token counts and scores, never note text
 * to logs beyond this local console. Writes out/results.json.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { AnthropicBedrock } from '@anthropic-ai/bedrock-sdk';
import { AnalyzeDocumentCommand, type Block, TextractClient } from '@aws-sdk/client-textract';

const REGION = 'ap-south-1';
const OUT = join(__dirname, 'out');
const IMAGE = join(__dirname, 'sample-lab-report.png');
// Decision (17 Nov 2026): Opus 5 via the India-only profile. See CLAUDE.md.
const MODELS = ['in.anthropic.claude-opus-5'] as const;

// ------------------------------------------------------------------ test inputs (synthetic)

/** Transcripts as Sarvam codemix returned them in the DIG-25 spike. */
const TRANSCRIPTS = [
  {
    id: 'en-gastro',
    text:
      'Patient complains of epigastric pain for two weeks. LFT shows raised ALT of ninety-four. Plan OGD next week. ' +
      'Start pantoprazole forty milligrams once daily before breakfast and ursodeoxycholic acid three hundred milligrams twice a day.',
    expectRx: [
      { drug: 'pantoprazole', dose: '40 mg' },
      { drug: 'ursodeoxycholic', dose: '300 mg' },
    ],
    expectInvestigations: ['OGD'],
  },
  {
    id: 'mixed-hi-en',
    text:
      'Patient को तीन दिन से fever है, LFT normal है, but ultrasound में fatty liver दिखा, ' +
      'so start ursodeoxycholic acid 300 mg twice daily और OGD next week करेंगे।',
    expectRx: [{ drug: 'ursodeoxycholic', dose: '300 mg' }],
    expectInvestigations: ['OGD'],
  },
];

/** Ground truth for sample-lab-report.png (see make-sample.py). */
const LAB_TRUTH: Record<string, string> = {
  'bilirubin, total': '1.4',
  'bilirubin, direct': '0.4',
  'sgot (ast)': '68',
  'sgpt (alt)': '94',
  'alkaline phosphatase': '118',
  ggt: '86',
  'total protein': '7.1',
  albumin: '4.0',
  globulin: '3.1',
  'a/g ratio': '1.29',
};
const RANGE_TRUTH: Record<string, string> = {
  'sgpt (alt)': '7-56',
  ggt: '8-61',
  albumin: '3.5-5.2',
};

// ------------------------------------------------------------------ schemas

const NOTE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['chief_complaint', 'history', 'findings', 'investigations', 'diagnosis', 'rx', 'follow_up'],
  properties: {
    chief_complaint: { type: ['string', 'null'] },
    history: { type: ['string', 'null'] },
    findings: { type: ['string', 'null'] },
    investigations: { type: 'array', items: { type: 'string' } },
    diagnosis: { type: ['string', 'null'] },
    rx: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['drug', 'dose', 'frequency', 'timing', 'duration'],
        properties: {
          drug: { type: 'string' },
          dose: { type: ['string', 'null'] },
          frequency: { type: ['string', 'null'] },
          timing: { type: ['string', 'null'] },
          duration: { type: ['string', 'null'] },
        },
      },
    },
    follow_up: { type: ['string', 'null'] },
  },
} as const;

const LAB_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['panel', 'rows'],
  properties: {
    panel: { type: ['string', 'null'] },
    rows: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['test', 'value', 'unit', 'ref_range', 'flag'],
        properties: {
          test: { type: 'string' },
          value: { type: 'string' },
          unit: { type: ['string', 'null'] },
          ref_range: { type: ['string', 'null'] },
          flag: { type: ['string', 'null'] },
        },
      },
    },
  },
} as const;

const NOTE_SYSTEM =
  "You turn an Indian OPD doctor's dictated consult (English, Hindi, Marathi, Gujarati or mixed) into note fields. " +
  'Write every field in English. Use only what was dictated; put null or [] when something was not said. ' +
  'Write doses with digits and units (e.g. "40 mg"), and frequency as said (e.g. "once daily").';

const LAB_SYSTEM =
  'You read photos of Indian lab reports. Return one row per test result exactly as printed: ' +
  'test name, value, unit, reference range and flag (H/L or null). The photo may be tilted, so ' +
  'follow each row across carefully and do not shift values between rows. Never guess a value you cannot read.';

// ------------------------------------------------------------------ helpers

interface Usage {
  input_tokens: number;
  output_tokens: number;
}

/** Anthropic list prices (USD per 1M tokens). Bedrock prices may differ; see the report. */
const PRICE: Record<string, { in: number; out: number }> = {
  'in.anthropic.claude-opus-5': { in: 5, out: 25 },
};
const usd = (model: string, u: Usage) =>
  ((PRICE[model]?.in ?? 0) * u.input_tokens + (PRICE[model]?.out ?? 0) * u.output_tokens) / 1e6;

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
const normRange = (s: string | null) => (s ?? '').replace(/\s+/g, '').replace(/[–—]/g, '-');

async function callJson(
  client: AnthropicBedrock,
  model: string,
  system: string,
  content: unknown[],
  schema: object,
): Promise<{ json: unknown; usage: Usage; ms: number; stop: string | null }> {
  const t = performance.now();
  const res = await client.messages.create({
    model,
    max_tokens: 16000,
    system,
    output_config: { effort: 'medium', format: { type: 'json_schema', schema } },
    messages: [{ role: 'user', content }],
  } as never);
  const ms = Math.round(performance.now() - t);
  const msg = res as unknown as {
    content: Array<{ type: string; text?: string }>;
    usage: Usage;
    stop_reason: string | null;
  };
  const text = msg.content.find((b) => b.type === 'text')?.text ?? '';
  return {
    json: msg.stop_reason === 'end_turn' ? JSON.parse(text) : null,
    usage: msg.usage,
    ms,
    stop: msg.stop_reason,
  };
}

// ------------------------------------------------------------------ tests

type Note = {
  investigations: string[];
  rx: Array<{ drug: string; dose: string | null }>;
} & Record<string, unknown>;
type Lab = { rows: Array<{ test: string; value: string; ref_range: string | null; flag: string | null }> };

function scoreNote(note: Note, t: (typeof TRANSCRIPTS)[number]) {
  const rxOk = t.expectRx.filter((e) =>
    note.rx.some(
      (r) =>
        norm(r.drug).includes(e.drug) && norm(r.dose ?? '').replace(/\s/g, '') === e.dose.replace(/\s/g, ''),
    ),
  ).length;
  const invOk = t.expectInvestigations.filter((i) =>
    note.investigations.some((x) => x.toUpperCase().includes(i)),
  ).length;
  return {
    rx: `${rxOk}/${t.expectRx.length}`,
    investigations: `${invOk}/${t.expectInvestigations.length}`,
    extraRx: note.rx.length - rxOk,
  };
}

function scoreLab(rows: Array<{ test: string; value: string; ref_range?: string | null }>) {
  const byTest = new Map(rows.map((r) => [norm(r.test), r]));
  const wrong: string[] = [];
  let ok = 0;
  for (const [test, value] of Object.entries(LAB_TRUTH)) {
    const r = byTest.get(test);
    if (r && r.value.trim() === value) ok++;
    else wrong.push(`${test}=${r?.value ?? 'missing'}`);
  }
  let rangeOk = 0;
  for (const [test, range] of Object.entries(RANGE_TRUTH)) {
    if (normRange(byTest.get(test)?.ref_range ?? null) === range) rangeOk++;
    else wrong.push(`${test} range=${byTest.get(test)?.ref_range ?? 'missing'}`);
  }
  return {
    values: `${ok}/${Object.keys(LAB_TRUTH).length}`,
    ranges: `${rangeOk}/${Object.keys(RANGE_TRUTH).length}`,
    wrong,
  };
}

/** Rebuild table rows from Textract TABLE/CELL blocks. */
function textractRows(blocks: Block[]): string[][] {
  const byId = new Map(blocks.map((b) => [b.Id, b]));
  const text = (cell: Block) =>
    (cell.Relationships ?? [])
      .filter((r) => r.Type === 'CHILD')
      .flatMap((r) => r.Ids ?? [])
      .map((id) => byId.get(id))
      .filter((b): b is Block => b?.BlockType === 'WORD')
      .map((b) => b.Text)
      .join(' ');
  const cellsOf = (table: Block) =>
    (table.Relationships ?? [])
      .filter((r) => r.Type === 'CHILD')
      .flatMap((r) => r.Ids ?? [])
      .map((id) => byId.get(id))
      .filter((b): b is Block => b?.BlockType === 'CELL');
  // Textract also returns the patient header as a small table; the results table is the biggest.
  const tables = blocks.filter((b) => b.BlockType === 'TABLE').map(cellsOf);
  const cells = tables.sort((a, b) => b.length - a.length)[0];
  if (!cells) return [];
  const grid: string[][] = [];
  for (const c of cells) {
    const row = (c.RowIndex ?? 1) - 1;
    (grid[row] ??= [])[(c.ColumnIndex ?? 1) - 1] = text(c);
  }
  return grid.map((r) => Array.from(r, (v) => v ?? ''));
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const client = new AnthropicBedrock({ awsRegion: REGION });
  const image = readFileSync(IMAGE);
  const results: Record<string, unknown>[] = [];

  const skipClaude = process.argv.includes('--textract-only');
  for (const model of skipClaude ? [] : MODELS) {
    for (const t of TRANSCRIPTS) {
      const r = await callJson(client, model, NOTE_SYSTEM, [{ type: 'text', text: t.text }], NOTE_SCHEMA);
      const score = r.json ? scoreNote(r.json as Note, t) : null;
      results.push({
        test: 'structuring',
        input: t.id,
        model,
        ms: r.ms,
        stop: r.stop,
        usage: r.usage,
        usd: usd(model, r.usage),
        score,
        output: r.json,
      });
      console.log(
        `structuring ${t.id} ${model}: ${r.ms} ms, ${r.usage.input_tokens}/${r.usage.output_tokens} tok, ${JSON.stringify(score)}`,
      );
    }
    const img = await callJson(
      client,
      model,
      LAB_SYSTEM,
      [
        {
          type: 'image',
          source: { type: 'base64', media_type: 'image/png', data: image.toString('base64') },
        },
        { type: 'text', text: 'Extract the lab results.' },
      ],
      LAB_SCHEMA,
    );
    const score = img.json ? scoreLab((img.json as Lab).rows) : null;
    results.push({
      test: 'image',
      input: 'sample-lab-report.png',
      model,
      ms: img.ms,
      stop: img.stop,
      usage: img.usage,
      usd: usd(model, img.usage),
      score,
      output: img.json,
    });
    console.log(
      `image ${model}: ${img.ms} ms, ${img.usage.input_tokens}/${img.usage.output_tokens} tok, ${JSON.stringify(score)}`,
    );
  }

  // Textract AnalyzeDocument (TABLES) in ap-south-1.
  const tx = new TextractClient({ region: REGION });
  const t0 = performance.now();
  const doc = await tx.send(
    new AnalyzeDocumentCommand({ Document: { Bytes: image }, FeatureTypes: ['TABLES'] }),
  );
  const ms = Math.round(performance.now() - t0);
  const grid = textractRows(doc.Blocks ?? []);
  // Columns as printed: Test | Result | Flag | Units | Ref. range
  const rows = grid
    .slice(1)
    .map((r) => ({ test: r[0] ?? '', value: (r[1] ?? '').trim(), ref_range: r[4] ?? null }));
  const score = scoreLab(rows);
  results.push({
    test: 'textract-tables',
    input: 'sample-lab-report.png',
    model: 'textract',
    ms,
    pages: doc.DocumentMetadata?.Pages,
    score,
    output: grid,
  });
  console.log(
    `textract tables: ${ms} ms, ${grid.length} rows x ${grid[0]?.length ?? 0} cols, ${JSON.stringify(score)}`,
  );

  writeFileSync(join(OUT, 'results.json'), JSON.stringify(results, null, 2));
}

main().catch((e: unknown) => {
  console.error((e as Error).message);
  process.exit(1);
});
