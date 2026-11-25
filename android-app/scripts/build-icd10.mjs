#!/usr/bin/env node
/**
 * Builds the ICD-10 list bundled in the app for the diagnosis picker (DIG-53).
 *
 * Source: CMS ICD-10-CM 2026, "Code Descriptions in Tabular Order"
 * (https://www.cms.gov/files/zip/2026-code-descriptions-tabular-order.zip, public domain).
 * Unzip it and pass icd10cm_order_2026.txt:
 *
 *   node android-app/scripts/build-icd10.mjs path/to/icd10cm_order_2026.txt
 *
 * Keeps billable codes only (complete codes a doctor can record) in three groups, gastro and
 * eye first in the picker, then common co-morbidities. Anything outside these is entered as Misc.
 * Writes android-app/src/consult/icd10/icd10-codes.json.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const [, , source] = process.argv;
if (!source) {
  process.stderr.write('usage: node build-icd10.mjs path/to/icd10cm_order_2026.txt\n');
  process.exit(1);
}

// Category (first 3 characters) ranges, inclusive. A prefix longer than 3 picks a sub-group.
const GROUPS = {
  g: [
    ['K00', 'K95'],
    ['R10', 'R19'],
    ['C15', 'C26'],
    ['D12', 'D13'],
    ['D37', 'D37'],
    ['B15', 'B19'],
    ['I85', 'I85'],
  ],
  e: [
    ['H00', 'H59'],
    ['E103', 'E103'],
    ['E113', 'E113'],
    ['S05', 'S05'],
    ['T15', 'T15'],
    ['Q10', 'Q15'],
    ['C69', 'C69'],
  ],
  o: [
    ['I10', 'I16'],
    ['I20', 'I25'],
    ['I48', 'I48'],
    ['I50', 'I50'],
    ['E10', 'E11'],
    ['E03', 'E03'],
    ['E05', 'E05'],
    ['E78', 'E78'],
    ['E66', 'E66'],
    ['E55', 'E55'],
    ['D50', 'D50'],
    ['D64', 'D64'],
    ['J44', 'J45'],
    ['N18', 'N18'],
    ['N40', 'N40'],
    ['G40', 'G40'],
    ['G43', 'G43'],
    ['F32', 'F32'],
    ['F41', 'F41'],
    ['M54', 'M54'],
    ['M17', 'M17'],
    ['A15', 'A15'],
    ['B20', 'B20'],
  ],
};

function inRange(code, [from, to]) {
  const head = code.slice(0, from.length);
  return head >= from && head <= to;
}

function groupOf(code) {
  // Eye first so diabetic retinopathy (E11.3x) is an eye code, not only a co-morbidity.
  for (const g of ['e', 'g', 'o']) if (GROUPS[g].some((r) => inRange(code, r))) return g;
  return null;
}

const codes = [];
for (const line of readFileSync(source, 'utf8').split(/\r?\n/)) {
  if (line.length < 78) continue;
  const raw = line.slice(6, 13).trim();
  const billable = line.slice(14, 15) === '1';
  const title = line.slice(77).trim();
  if (!billable) continue;
  const group = groupOf(raw);
  if (!group) continue;
  const code = raw.length > 3 ? `${raw.slice(0, 3)}.${raw.slice(3)}` : raw;
  codes.push([code, title, group]);
}

const out = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'src',
  'consult',
  'icd10',
  'icd10-codes.json',
);
writeFileSync(out, JSON.stringify({ source: 'ICD-10-CM 2026 (CMS, public domain)', codes }) + '\n');
const counts = codes.reduce((a, [, , g]) => ({ ...a, [g]: (a[g] ?? 0) + 1 }), {});
process.stdout.write(`wrote ${codes.length} codes ${JSON.stringify(counts)}\n`);
