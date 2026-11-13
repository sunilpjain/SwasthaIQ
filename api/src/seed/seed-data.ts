/**
 * Synthetic seed data for the Arihant prototype (DIG-36), exactly as in the functional spec.
 * ALL NAMES AND CLINICAL DETAILS ARE FICTIONAL. Never add real patient data here.
 */

export type SeedUsername = 'saiyam' | 'samradnyee' | 'admin';

export interface SeedUser {
  username: SeedUsername;
  displayName: string;
  role: 'doctor' | 'admin';
  specialty: 'gastro' | 'eye' | null;
  qualifications: string | null;
  registrationNo: string | null;
}

export const SEED_USERS: SeedUser[] = [
  {
    username: 'saiyam',
    displayName: 'Dr. Saiyam Shah',
    role: 'doctor',
    specialty: 'gastro',
    qualifications: 'MBBS, MS, MCh (Surgical Gastroenterology)',
    registrationNo: 'SAMPLE-GMC-000101',
  },
  {
    username: 'samradnyee',
    displayName: 'Dr. Samradnyee Shah',
    role: 'doctor',
    specialty: 'eye',
    qualifications: 'MBBS, DNB (Ophthalmology)',
    registrationNo: 'SAMPLE-GMC-000102',
  },
  {
    username: 'admin',
    displayName: 'Admin',
    role: 'admin',
    specialty: null,
    qualifications: null,
    registrationNo: null,
  },
];

export interface SeedPatient {
  token: string;
  fullName: string;
  ageYears: number;
  sex: 'M' | 'F';
  guardianName?: string;
  phone: string;
  doctor: SeedUsername;
  reason: string;
  allergies?: string[];
  conditions?: string[];
}

export const SEED_PATIENTS: SeedPatient[] = [
  {
    token: 'G1',
    fullName: 'Rakesh Desai',
    ageYears: 52,
    sex: 'M',
    phone: '90000 10001',
    doctor: 'saiyam',
    reason: 'GERD follow-up',
    conditions: ['GERD', 'Grade B oesophagitis'],
  },
  {
    token: 'G2',
    fullName: 'Meena Patel',
    ageYears: 45,
    sex: 'F',
    phone: '90000 10002',
    doctor: 'saiyam',
    reason: 'Gallstones, pre-op review for lap cholecystectomy',
    conditions: ['Cholelithiasis'],
  },
  {
    token: 'G3',
    fullName: 'Imran Shaikh',
    ageYears: 38,
    sex: 'M',
    phone: '90000 10003',
    doctor: 'saiyam',
    reason: 'Fatty liver, raised ALT',
    conditions: ['NAFLD'],
  },
  {
    token: 'G4',
    fullName: 'Jignesh Modi',
    ageYears: 61,
    sex: 'M',
    phone: '90000 10004',
    doctor: 'saiyam',
    reason: 'Day 10 after lap cholecystectomy, wound check',
    conditions: ['Hypertension', 'Post lap cholecystectomy'],
  },
  {
    token: 'G5',
    fullName: 'Komal Joshi',
    ageYears: 29,
    sex: 'F',
    phone: '90000 10005',
    doctor: 'saiyam',
    reason: 'Abdominal pain, ? IBS',
  },
  {
    token: 'G6',
    fullName: 'Harish Mehta',
    ageYears: 67,
    sex: 'M',
    phone: '90000 10006',
    doctor: 'saiyam',
    reason: 'Chronic pancreatitis with diabetes',
    conditions: ['Chronic pancreatitis', 'Type 2 diabetes', 'Mild NPDR'],
  },
  {
    token: 'E1',
    fullName: 'Kantaben Shah',
    ageYears: 68,
    sex: 'F',
    phone: '90000 20001',
    doctor: 'samradnyee',
    reason: 'Cataract assessment, both eyes; diabetic',
    allergies: ['Sulfonamides'],
    conditions: ['Type 2 diabetes', 'Cholelithiasis'],
  },
  {
    token: 'E2',
    fullName: 'Nilesh Rana',
    ageYears: 55,
    sex: 'M',
    phone: '90000 20002',
    doctor: 'samradnyee',
    reason: 'Diabetic retinopathy follow-up',
    conditions: ['Type 2 diabetes', 'Moderate NPDR', 'NAFLD'],
  },
  {
    token: 'E3',
    fullName: 'Priya Kapadia',
    ageYears: 24,
    sex: 'F',
    phone: '90000 20003',
    doctor: 'samradnyee',
    reason: 'Spectacle check, eye strain',
  },
  {
    token: 'E4',
    fullName: 'Bhavesh Solanki',
    ageYears: 47,
    sex: 'M',
    phone: '90000 20004',
    doctor: 'samradnyee',
    reason: 'Glaucoma follow-up',
    conditions: ['Primary open-angle glaucoma'],
  },
  {
    token: 'E5',
    fullName: 'Aarav Trivedi',
    ageYears: 9,
    sex: 'M',
    guardianName: 'Hetal Trivedi',
    phone: '90000 20005',
    doctor: 'samradnyee',
    reason: 'Itchy red eyes, ? allergic conjunctivitis',
    conditions: ['Allergic conjunctivitis (past)'],
  },
  {
    token: 'E6',
    fullName: 'Ramesh Parmar',
    ageYears: 72,
    sex: 'M',
    phone: '90000 20006',
    doctor: 'samradnyee',
    reason: 'Day 7 after right-eye cataract surgery',
    conditions: ['Pseudophakia RE'],
  },
];

export interface SeedField {
  section: string;
  key: string;
  value: string;
  source?: 'dictated' | 'scanned' | 'typed';
}

export interface SeedRx {
  brand: string;
  generic: string;
  form: string;
  eye?: 'RE' | 'LE' | 'BE';
  dose: string;
  frequency: string;
  timing?: string;
  duration: string;
  taper?: string;
  instructionsEn?: string;
}

export interface SeedLab {
  code: string;
  name: string;
  value: string;
  unit?: string;
  ref?: string;
  flag?: 'H' | 'L';
}

export interface SeedVisit {
  key: string; // stable key → deterministic UUID
  patient: string; // token
  doctor: SeedUsername;
  date: string;
  diagnosis: string;
  icd10?: string;
  fields: SeedField[];
  rx?: SeedRx[];
  advice?: string;
  labs?: { date: string; labName: string; values: SeedLab[] };
}

const LAB_A = 'Sunrise Diagnostics (fictitious)';
const LAB_B = 'Tapi Pathology Lab (fictitious)';

/** 10 patients with 1–2 past visits; G5 and E3 are new. G6, E1, E2 have seen both doctors. */
export const SEED_VISITS: SeedVisit[] = [
  // ---------------- G1 Rakesh Desai
  {
    key: 'G1-v1',
    patient: 'G1',
    doctor: 'saiyam',
    date: '2026-08-14',
    diagnosis: 'GERD with grade B reflux oesophagitis',
    icd10: 'K21.0',
    fields: [
      { section: 'complaint', key: 'chief_complaint', value: 'Burning in chest after meals for 4 months' },
      {
        section: 'gastro',
        key: 'investigation_summary',
        value: 'OGD (outside): LA grade B oesophagitis, no Barrett’s',
      },
      { section: 'plan', key: 'advice', value: 'Small meals, avoid late dinner, raise head end of bed' },
    ],
    rx: [
      {
        brand: 'Pan 40',
        generic: 'pantoprazole 40 mg',
        form: 'Tablet',
        dose: '1',
        frequency: '1-0-0',
        timing: '30 min before breakfast',
        duration: '8 weeks',
      },
    ],
  },
  // ---------------- G2 Meena Patel
  {
    key: 'G2-v1',
    patient: 'G2',
    doctor: 'saiyam',
    date: '2026-10-23',
    diagnosis: 'Symptomatic cholelithiasis',
    icd10: 'K80.20',
    fields: [
      {
        section: 'complaint',
        key: 'chief_complaint',
        value: 'Right upper abdominal pain after fatty meals, 3 episodes in 2 months',
      },
      {
        section: 'gastro',
        key: 'investigation_summary',
        value: 'USG abdomen: multiple gallbladder calculi, largest 12 mm; CBD 5 mm',
      },
      { section: 'plan', key: 'plan', value: 'Lap cholecystectomy; pre-op tests ordered' },
    ],
    rx: [
      {
        brand: 'Meftal-Spas',
        generic: 'mefenamic acid + dicyclomine',
        form: 'Tablet',
        dose: '1',
        frequency: 'SOS',
        duration: '2 weeks',
        instructionsEn: 'Only when pain',
      },
    ],
  },
  // ---------------- G3 Imran Shaikh (ALT trend)
  {
    key: 'G3-v1',
    patient: 'G3',
    doctor: 'saiyam',
    date: '2026-07-10',
    diagnosis: 'Non-alcoholic fatty liver disease',
    icd10: 'K76.0',
    fields: [
      { section: 'complaint', key: 'chief_complaint', value: 'Raised liver enzymes on routine check-up' },
      { section: 'vitals', key: 'weight_kg', value: '88' },
      { section: 'plan', key: 'advice', value: 'Lose 5–7% body weight; brisk walk 45 min daily' },
    ],
    labs: {
      date: '2026-07-08',
      labName: LAB_A,
      values: [
        { code: 'ALT', name: 'SGPT (ALT)', value: '112', unit: 'U/L', ref: '7–56', flag: 'H' },
        { code: 'AST', name: 'SGOT (AST)', value: '68', unit: 'U/L', ref: '10–40', flag: 'H' },
        { code: 'ALP', name: 'Alkaline phosphatase', value: '98', unit: 'U/L', ref: '44–147' },
      ],
    },
  },
  {
    key: 'G3-v2',
    patient: 'G3',
    doctor: 'saiyam',
    date: '2026-09-18',
    diagnosis: 'NAFLD, improving',
    icd10: 'K76.0',
    fields: [
      { section: 'complaint', key: 'chief_complaint', value: 'Follow-up; lost 3 kg' },
      { section: 'vitals', key: 'weight_kg', value: '85' },
    ],
    rx: [
      {
        brand: 'Udiliv 300',
        generic: 'ursodeoxycholic acid 300 mg',
        form: 'Tablet',
        dose: '1',
        frequency: '1-0-1',
        timing: 'after food',
        duration: '3 months',
      },
    ],
    labs: {
      date: '2026-09-16',
      labName: LAB_B,
      values: [
        { code: 'ALT', name: 'ALT/SGPT', value: '94', unit: 'U/L', ref: '0–45', flag: 'H' },
        { code: 'AST', name: 'AST/SGOT', value: '55', unit: 'U/L', ref: '0–35', flag: 'H' },
      ],
    },
  },
  // ---------------- G4 Jignesh Modi
  {
    key: 'G4-v1',
    patient: 'G4',
    doctor: 'saiyam',
    date: '2026-11-03',
    diagnosis: 'Lap cholecystectomy done for cholelithiasis',
    icd10: 'Z90.49',
    fields: [
      {
        section: 'gastro',
        key: 'operation_note',
        value: 'Uneventful 4-port lap cholecystectomy; drain removed day 1',
      },
      { section: 'plan', key: 'follow_up', value: 'Wound check on day 10' },
    ],
    rx: [
      {
        brand: 'Augmentin 625',
        generic: 'amoxicillin + clavulanate 625 mg',
        form: 'Tablet',
        dose: '1',
        frequency: '1-0-1',
        timing: 'after food',
        duration: '5 days',
      },
      {
        brand: 'Pan 40',
        generic: 'pantoprazole 40 mg',
        form: 'Tablet',
        dose: '1',
        frequency: '1-0-0',
        timing: 'before breakfast',
        duration: '5 days',
      },
      {
        brand: 'Dolo 650',
        generic: 'paracetamol 650 mg',
        form: 'Tablet',
        dose: '1',
        frequency: 'SOS',
        duration: '5 days',
        instructionsEn: 'For pain, max 3 a day',
      },
    ],
  },
  // ---------------- G6 Harish Mehta (shared)
  {
    key: 'G6-v1',
    patient: 'G6',
    doctor: 'saiyam',
    date: '2026-06-12',
    diagnosis: 'Chronic calcific pancreatitis with pancreatic diabetes',
    icd10: 'K86.1',
    fields: [
      {
        section: 'complaint',
        key: 'chief_complaint',
        value: 'Recurrent upper abdominal pain, loose oily stools',
      },
      { section: 'gastro', key: 'bowel_habit', value: 'Steatorrhoea 3–4 times a day' },
    ],
    rx: [
      {
        brand: 'Creon 25000',
        generic: 'pancreatin 25000 units',
        form: 'Capsule',
        dose: '1',
        frequency: 'with each meal',
        duration: '3 months',
      },
    ],
    labs: {
      date: '2026-06-10',
      labName: LAB_A,
      values: [
        { code: 'AMYLASE', name: 'Serum amylase', value: '210', unit: 'U/L', ref: '30–110', flag: 'H' },
        { code: 'LIPASE', name: 'Serum lipase', value: '380', unit: 'U/L', ref: '0–160', flag: 'H' },
        { code: 'HBA1C', name: 'HbA1c', value: '8.9', unit: '%', ref: '4.0–5.6', flag: 'H' },
      ],
    },
  },
  {
    key: 'G6-v2',
    patient: 'G6',
    doctor: 'saiyam',
    date: '2026-09-11',
    diagnosis: 'Chronic pancreatitis, pain controlled',
    icd10: 'K86.1',
    fields: [
      { section: 'complaint', key: 'chief_complaint', value: 'Pain better; stools formed on enzymes' },
    ],
    labs: {
      date: '2026-09-09',
      labName: LAB_B,
      values: [
        { code: 'AMYLASE', name: 'Amylase', value: '140', unit: 'U/L', ref: '28–100', flag: 'H' },
        { code: 'HBA1C', name: 'Glycated haemoglobin', value: '8.1', unit: '%', ref: '< 5.7', flag: 'H' },
      ],
    },
  },
  {
    key: 'G6-v3',
    patient: 'G6',
    doctor: 'samradnyee',
    date: '2026-10-05',
    diagnosis: 'Mild non-proliferative diabetic retinopathy, both eyes',
    icd10: 'E11.329',
    fields: [
      { section: 'eye', key: 're_va_glasses', value: '6/9' },
      { section: 'eye', key: 'le_va_glasses', value: '6/9' },
      { section: 'eye', key: 're_fundus', value: 'Few microaneurysms, no macular oedema' },
      { section: 'eye', key: 'le_fundus', value: 'Few microaneurysms, no macular oedema' },
      { section: 'plan', key: 'follow_up', value: 'Review in 6 months; tighten sugar control' },
    ],
  },
  // ---------------- E1 Kantaben Shah (shared)
  {
    key: 'E1-v1',
    patient: 'E1',
    doctor: 'samradnyee',
    date: '2025-11-20',
    diagnosis: 'Early senile cataract, both eyes; presbyopia',
    icd10: 'H25.9',
    fields: [
      { section: 'eye', key: 're_refraction', value: '+1.00 / -0.50 × 90, add +2.50' },
      { section: 'eye', key: 'le_refraction', value: '+0.75 / -0.75 × 85, add +2.50' },
      { section: 'eye', key: 're_lens', value: 'NS grade 1' },
      { section: 'eye', key: 'le_lens', value: 'NS grade 1' },
    ],
  },
  {
    key: 'E1-v2',
    patient: 'E1',
    doctor: 'saiyam',
    date: '2026-09-25',
    diagnosis: 'Asymptomatic cholelithiasis',
    icd10: 'K80.20',
    fields: [
      { section: 'complaint', key: 'chief_complaint', value: 'Gallstones found on USG; occasional bloating' },
      { section: 'plan', key: 'plan', value: 'Surgery deferred until after cataract surgery' },
    ],
  },
  // ---------------- E2 Nilesh Rana (shared, HbA1c trend)
  {
    key: 'E2-v1',
    patient: 'E2',
    doctor: 'saiyam',
    date: '2026-08-28',
    diagnosis: 'NAFLD with type 2 diabetes',
    icd10: 'K76.0',
    fields: [{ section: 'complaint', key: 'chief_complaint', value: 'Fatty liver on USG; on metformin' }],
    rx: [
      {
        brand: 'Glycomet 500',
        generic: 'metformin 500 mg',
        form: 'Tablet',
        dose: '1',
        frequency: '1-0-1',
        timing: 'after food',
        duration: '3 months',
      },
    ],
    labs: {
      date: '2026-08-26',
      labName: LAB_A,
      values: [
        { code: 'ALT', name: 'SGPT (ALT)', value: '78', unit: 'U/L', ref: '7–56', flag: 'H' },
        { code: 'HBA1C', name: 'HbA1c', value: '9.2', unit: '%', ref: '4.0–5.6', flag: 'H' },
      ],
    },
  },
  {
    key: 'E2-v2',
    patient: 'E2',
    doctor: 'samradnyee',
    date: '2026-10-16',
    diagnosis: 'Moderate NPDR, both eyes',
    icd10: 'E11.339',
    fields: [
      { section: 'eye', key: 're_fundus', value: 'Dot-blot haemorrhages in 2 quadrants, hard exudates' },
      { section: 'eye', key: 'le_fundus', value: 'Dot-blot haemorrhages in 2 quadrants' },
      { section: 'plan', key: 'follow_up', value: 'OCT macula at next visit' },
    ],
    labs: {
      date: '2026-10-14',
      labName: LAB_B,
      values: [
        { code: 'HBA1C', name: 'Glycated haemoglobin', value: '8.4', unit: '%', ref: '< 5.7', flag: 'H' },
      ],
    },
  },
  // ---------------- E4 Bhavesh Solanki (IOP trend)
  {
    key: 'E4-v1',
    patient: 'E4',
    doctor: 'samradnyee',
    date: '2026-05-15',
    diagnosis: 'Primary open-angle glaucoma, both eyes',
    icd10: 'H40.1130',
    fields: [
      { section: 'eye', key: 're_iop', value: '26' },
      { section: 'eye', key: 'le_iop', value: '24' },
      { section: 'eye', key: 're_fundus', value: 'CDR 0.7' },
      { section: 'eye', key: 'le_fundus', value: 'CDR 0.6' },
    ],
    rx: [
      {
        brand: 'Iotim 0.5%',
        generic: 'timolol 0.5%',
        form: 'Eye drops',
        eye: 'BE',
        dose: '1 drop',
        frequency: 'twice a day',
        duration: '3 months',
      },
    ],
  },
  {
    key: 'E4-v2',
    patient: 'E4',
    doctor: 'samradnyee',
    date: '2026-08-14',
    diagnosis: 'POAG, IOP controlled on timolol',
    icd10: 'H40.1130',
    fields: [
      { section: 'eye', key: 're_iop', value: '19' },
      { section: 'eye', key: 'le_iop', value: '18' },
    ],
    rx: [
      {
        brand: 'Iotim 0.5%',
        generic: 'timolol 0.5%',
        form: 'Eye drops',
        eye: 'BE',
        dose: '1 drop',
        frequency: 'twice a day',
        duration: '3 months',
      },
    ],
  },
  // ---------------- E5 Aarav Trivedi
  {
    key: 'E5-v1',
    patient: 'E5',
    doctor: 'samradnyee',
    date: '2026-04-10',
    diagnosis: 'Allergic conjunctivitis, both eyes',
    icd10: 'H10.13',
    fields: [
      { section: 'complaint', key: 'chief_complaint', value: 'Itching and redness both eyes in spring' },
    ],
    rx: [
      {
        brand: 'Olopat',
        generic: 'olopatadine 0.1%',
        form: 'Eye drops',
        eye: 'BE',
        dose: '1 drop',
        frequency: 'twice a day',
        duration: '2 weeks',
      },
    ],
  },
  // ---------------- E6 Ramesh Parmar
  {
    key: 'E6-v1',
    patient: 'E6',
    doctor: 'samradnyee',
    date: '2026-11-06',
    diagnosis: 'Right eye phacoemulsification with PCIOL',
    icd10: 'Z96.1',
    fields: [
      { section: 'eye', key: 'surgery_plan', value: 'RE phaco + foldable PCIOL 21.5 D, uneventful' },
      { section: 'plan', key: 'follow_up', value: 'Day 7 review' },
    ],
    rx: [
      {
        brand: 'Pred Forte',
        generic: 'prednisolone acetate 1%',
        form: 'Eye drops',
        eye: 'RE',
        dose: '1 drop',
        frequency: 'tapering',
        duration: '4 weeks',
        taper: '6×/day week 1, 4× week 2, 3× week 3, 2× week 4, then stop',
      },
      {
        brand: 'Vigamox',
        generic: 'moxifloxacin 0.5%',
        form: 'Eye drops',
        eye: 'RE',
        dose: '1 drop',
        frequency: '4 times a day',
        duration: '1 week',
      },
    ],
  },
];
