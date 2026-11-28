import type { AllergyClass, Medicine, MedicineDefaults, OrderSet, Specialty } from '@swasthyaiq/shared';

/**
 * Medicine catalogue and order sets (DIG-69). DRAFT for the doctors to confirm.
 *
 * Generic names only (decision 20 Nov): no brands. Indicative, not a validated formulary; the
 * doses are common adult starting points that the doctor changes per patient. Frequency is the
 * 4-slot morning-noon-evening-night form (1-0-0-1). To change the list, edit this file and deploy;
 * `catalogue.spec.ts` checks every entry.
 */

export const CATALOGUE_NOTE =
  'Indicative list for the prototype, not a validated formulary. Check every dose.';

const OD = '1-0-0-0';
const BD = '1-0-0-1';
const TDS = '1-1-0-1';
const QID = '1-1-1-1';
const HS = '0-0-0-1';
const SOS = 'SOS';

type Row = [
  id: string,
  generic: string,
  strength: string,
  form: string,
  therapeuticClass: string,
  allergy: AllergyClass[],
  dose: string,
  frequency: string,
  timing: string | null,
  duration: string,
  taper?: string,
];

function build(specialty: Specialty, rows: Row[]): Medicine[] {
  return rows.map(
    ([
      id,
      generic,
      strength,
      form,
      therapeuticClass,
      allergyClasses,
      dose,
      frequency,
      timing,
      duration,
      taper,
    ]) => {
      const defaults: MedicineDefaults = { dose, frequency, timing, duration };
      if (taper) defaults.taper = taper;
      return {
        id,
        specialty,
        generic,
        strength,
        form,
        route: /eye/i.test(form) ? 'eye' : 'oral',
        therapeuticClass,
        allergyClasses,
        defaults,
      };
    },
  );
}

const BEFORE_BREAKFAST = '30 min before breakfast';
const BEFORE_FOOD = 'before food';
const AFTER_FOOD = 'after food';
const WITH_MEALS = 'with meals';

// prettier-ignore
const GASTRO: Row[] = [
  ['pantoprazole-40-tab', 'pantoprazole', '40 mg', 'Tablet', 'ppi', [], '1', OD, BEFORE_BREAKFAST, '4 weeks'],
  ['rabeprazole-20-tab', 'rabeprazole', '20 mg', 'Tablet', 'ppi', [], '1', OD, BEFORE_BREAKFAST, '4 weeks'],
  ['esomeprazole-40-tab', 'esomeprazole', '40 mg', 'Tablet', 'ppi', [], '1', OD, BEFORE_BREAKFAST, '4 weeks'],
  ['omeprazole-20-cap', 'omeprazole', '20 mg', 'Capsule', 'ppi', [], '1', OD, BEFORE_BREAKFAST, '4 weeks'],
  ['domperidone-10-tab', 'domperidone', '10 mg', 'Tablet', 'prokinetic', [], '1', TDS, BEFORE_FOOD, '2 weeks'],
  ['itopride-50-tab', 'itopride', '50 mg', 'Tablet', 'prokinetic', [], '1', TDS, BEFORE_FOOD, '4 weeks'],
  ['levosulpiride-25-tab', 'levosulpiride', '25 mg', 'Tablet', 'prokinetic', [], '1', TDS, BEFORE_FOOD, '2 weeks'],
  ['ondansetron-4-tab', 'ondansetron', '4 mg', 'Tablet', 'antiemetic', [], '1', SOS, null, '3 days'],
  ['drotaverine-80-tab', 'drotaverine', '80 mg', 'Tablet', 'antispasmodic', [], '1', SOS, null, '5 days'],
  ['dicyclomine-20-tab', 'dicyclomine', '20 mg', 'Tablet', 'antispasmodic', [], '1', SOS, null, '5 days'],
  ['hyoscine-10-tab', 'hyoscine butylbromide', '10 mg', 'Tablet', 'antispasmodic', [], '1', SOS, null, '5 days'],
  ['mebeverine-135-tab', 'mebeverine', '135 mg', 'Tablet', 'antispasmodic', [], '1', TDS, BEFORE_FOOD, '4 weeks'],
  ['lactulose-syr', 'lactulose', '10 g/15 ml', 'Syrup', 'laxative', [], '15 ml', HS, null, '2 weeks'],
  ['peg3350-powder', 'polyethylene glycol 3350', '17 g', 'Powder', 'laxative', [], '1 sachet', HS, 'in a glass of water', '2 weeks'],
  ['bisacodyl-5-tab', 'bisacodyl', '5 mg', 'Tablet', 'laxative', [], '1', HS, null, '5 days'],
  ['ispaghula-powder', 'ispaghula husk', '3.5 g', 'Powder', 'laxative', [], '2 tsp', HS, 'in water', '4 weeks'],
  ['udca-300-tab', 'ursodeoxycholic acid', '300 mg', 'Tablet', 'bile-acid', [], '1', BD, AFTER_FOOD, '3 months'],
  ['rifaximin-550-tab', 'rifaximin', '550 mg', 'Tablet', 'gut-antibiotic', [], '1', BD, null, '2 weeks'],
  ['silymarin-140-cap', 'silymarin', '140 mg', 'Capsule', 'liver-support', [], '1', TDS, AFTER_FOOD, '3 months'],
  ['pancreatin-25000-cap', 'pancreatin', '25,000 units', 'Capsule', 'pancreatic-enzyme', [], '1', TDS, WITH_MEALS, '3 months'],
  ['sucralfate-susp', 'sucralfate', '1 g/10 ml', 'Suspension', 'mucosal-protectant', [], '10 ml', TDS, BEFORE_FOOD, '4 weeks'],
  ['amox-clav-625-tab', 'amoxicillin + clavulanic acid', '625 mg', 'Tablet', 'penicillin', ['penicillin'], '1', BD, AFTER_FOOD, '5 days'],
  ['cefixime-200-tab', 'cefixime', '200 mg', 'Tablet', 'cephalosporin', ['cephalosporin'], '1', BD, AFTER_FOOD, '5 days'],
  ['ciprofloxacin-500-tab', 'ciprofloxacin', '500 mg', 'Tablet', 'fluoroquinolone', ['fluoroquinolone'], '1', BD, AFTER_FOOD, '5 days'],
  ['metronidazole-400-tab', 'metronidazole', '400 mg', 'Tablet', 'nitroimidazole', ['nitroimidazole'], '1', TDS, AFTER_FOOD, '5 days'],
  ['ornidazole-500-tab', 'ornidazole', '500 mg', 'Tablet', 'nitroimidazole', ['nitroimidazole'], '1', BD, AFTER_FOOD, '5 days'],
  ['paracetamol-650-tab', 'paracetamol', '650 mg', 'Tablet', 'analgesic', [], '1', SOS, AFTER_FOOD, '5 days'],
  ['diclofenac-50-tab', 'diclofenac', '50 mg', 'Tablet', 'nsaid', ['nsaid'], '1', SOS, AFTER_FOOD, '3 days'],
  ['tramadol-50-tab', 'tramadol', '50 mg', 'Tablet', 'opioid', ['opioid'], '1', SOS, AFTER_FOOD, '3 days'],
  ['ors-sachet', 'oral rehydration salts', '21 g', 'Sachet', 'rehydration', [], '1 sachet in 1 litre water', 'Sip through the day', null, '3 days'],
];

const PRED_TAPER = '6× a day for 1 week, then 4×, 3×, 2× and 1× a day, one week each';

// prettier-ignore
const EYE: Row[] = [
  ['moxifloxacin-05-drops', 'moxifloxacin', '0.5%', 'Eye drops', 'fluoroquinolone', ['fluoroquinolone'], '1 drop', QID, null, '1 week'],
  ['ofloxacin-03-drops', 'ofloxacin', '0.3%', 'Eye drops', 'fluoroquinolone', ['fluoroquinolone'], '1 drop', QID, null, '1 week'],
  ['tobramycin-03-drops', 'tobramycin', '0.3%', 'Eye drops', 'aminoglycoside', ['aminoglycoside'], '1 drop', QID, null, '1 week'],
  ['chloramphenicol-05-drops', 'chloramphenicol', '0.5%', 'Eye drops', 'antibiotic', [], '1 drop', QID, null, '1 week'],
  ['tobramycin-03-ointment', 'tobramycin', '0.3%', 'Eye ointment', 'aminoglycoside', ['aminoglycoside'], '1 cm', HS, null, '1 week'],
  ['prednisolone-1-drops', 'prednisolone acetate', '1%', 'Eye drops', 'steroid', [], '1 drop', '6× a day', null, '5 weeks', PRED_TAPER],
  ['loteprednol-05-drops', 'loteprednol etabonate', '0.5%', 'Eye drops', 'steroid', [], '1 drop', QID, null, '2 weeks'],
  ['fml-01-drops', 'fluorometholone', '0.1%', 'Eye drops', 'steroid', [], '1 drop', QID, null, '1 week'],
  ['dexamethasone-01-drops', 'dexamethasone', '0.1%', 'Eye drops', 'steroid', [], '1 drop', QID, null, '1 week'],
  ['moxi-dexa-drops', 'moxifloxacin + dexamethasone', '0.5% + 0.1%', 'Eye drops', 'antibiotic-steroid', ['fluoroquinolone'], '1 drop', QID, null, '2 weeks'],
  ['nepafenac-01-drops', 'nepafenac', '0.1%', 'Eye drops', 'nsaid', ['nsaid'], '1 drop', TDS, null, '4 weeks'],
  ['ketorolac-05-drops', 'ketorolac', '0.5%', 'Eye drops', 'nsaid', ['nsaid'], '1 drop', QID, null, '2 weeks'],
  ['bromfenac-009-drops', 'bromfenac', '0.09%', 'Eye drops', 'nsaid', ['nsaid'], '1 drop', BD, null, '2 weeks'],
  ['timolol-05-drops', 'timolol', '0.5%', 'Eye drops', 'beta-blocker', [], '1 drop', BD, null, '3 months'],
  ['latanoprost-0005-drops', 'latanoprost', '0.005%', 'Eye drops', 'prostaglandin', [], '1 drop', HS, null, '3 months'],
  ['bimatoprost-001-drops', 'bimatoprost', '0.01%', 'Eye drops', 'prostaglandin', [], '1 drop', HS, null, '3 months'],
  ['brimonidine-02-drops', 'brimonidine', '0.2%', 'Eye drops', 'alpha-agonist', [], '1 drop', BD, null, '3 months'],
  ['dorzolamide-2-drops', 'dorzolamide', '2%', 'Eye drops', 'carbonic-anhydrase-inhibitor', ['sulfonamide'], '1 drop', TDS, null, '3 months'],
  ['brinzolamide-1-drops', 'brinzolamide', '1%', 'Eye drops', 'carbonic-anhydrase-inhibitor', ['sulfonamide'], '1 drop', BD, null, '3 months'],
  ['cmc-05-drops', 'carboxymethylcellulose', '0.5%', 'Eye drops', 'lubricant', [], '1 drop', QID, null, '1 month'],
  ['cmc-1-gel', 'carboxymethylcellulose', '1%', 'Eye gel', 'lubricant', [], '1 drop', HS, null, '1 month'],
  ['hyaluronate-01-drops', 'sodium hyaluronate', '0.1%', 'Eye drops', 'lubricant', [], '1 drop', QID, null, '1 month'],
  ['olopatadine-01-drops', 'olopatadine', '0.1%', 'Eye drops', 'anti-allergy', [], '1 drop', BD, null, '2 weeks'],
  ['ketotifen-0025-drops', 'ketotifen', '0.025%', 'Eye drops', 'anti-allergy', [], '1 drop', BD, null, '2 weeks'],
  ['cyclopentolate-1-drops', 'cyclopentolate', '1%', 'Eye drops', 'cycloplegic', [], '1 drop', BD, null, '1 week'],
  ['homatropine-2-drops', 'homatropine', '2%', 'Eye drops', 'cycloplegic', [], '1 drop', BD, null, '1 week'],
  ['atropine-1-drops', 'atropine', '1%', 'Eye drops', 'cycloplegic', [], '1 drop', OD, null, '1 week'],
  ['acyclovir-3-ointment', 'acyclovir', '3%', 'Eye ointment', 'antiviral', [], '1 cm', '5× a day', null, '2 weeks'],
  ['acetazolamide-250-tab', 'acetazolamide', '250 mg', 'Tablet', 'carbonic-anhydrase-inhibitor', ['sulfonamide'], '1', TDS, AFTER_FOOD, '3 days'],
  ['doxycycline-100-cap', 'doxycycline', '100 mg', 'Capsule', 'tetracycline', ['tetracycline'], '1', OD, AFTER_FOOD, '6 weeks'],
];

export const MEDICINES: Medicine[] = [...build('gastro', GASTRO), ...build('eye', EYE)];

export const ORDER_SETS: OrderSet[] = [
  {
    id: 'gerd',
    specialty: 'gastro',
    name: 'GERD',
    lines: [{ medicineId: 'pantoprazole-40-tab', duration: '8 weeks' }, { medicineId: 'itopride-50-tab' }],
  },
  {
    id: 'ibs',
    specialty: 'gastro',
    name: 'IBS',
    lines: [{ medicineId: 'mebeverine-135-tab' }, { medicineId: 'ispaghula-powder' }],
  },
  {
    id: 'post-lap-chole',
    specialty: 'gastro',
    name: 'Post-lap cholecystectomy',
    lines: [
      { medicineId: 'amox-clav-625-tab' },
      { medicineId: 'pantoprazole-40-tab', duration: '5 days' },
      { medicineId: 'paracetamol-650-tab', frequency: TDS },
    ],
  },
  {
    id: 'post-cataract',
    specialty: 'eye',
    name: 'Post-cataract',
    lines: [
      { medicineId: 'moxifloxacin-05-drops' },
      { medicineId: 'prednisolone-1-drops' },
      { medicineId: 'nepafenac-01-drops' },
      { medicineId: 'cmc-05-drops' },
    ],
  },
  {
    id: 'glaucoma-starter',
    specialty: 'eye',
    name: 'Glaucoma starter',
    lines: [{ medicineId: 'latanoprost-0005-drops' }],
  },
  {
    id: 'allergic-conjunctivitis',
    specialty: 'eye',
    name: 'Allergic conjunctivitis',
    lines: [{ medicineId: 'olopatadine-01-drops' }, { medicineId: 'cmc-05-drops', duration: '2 weeks' }],
  },
];
