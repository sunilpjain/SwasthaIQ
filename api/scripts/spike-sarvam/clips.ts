/**
 * DIG-25 spike: synthetic consult dictation clips. No real patients and no names.
 * `text` is both what TTS speaks and the reference transcript used for WER.
 * `terms` are the medical terms we check, each with the spellings we accept
 * (Latin or native script) since Sarvam may write either.
 */
export interface Term {
  label: string;
  accept: string[];
}

export interface Clip {
  id: string;
  language: 'en-IN' | 'hi-IN' | 'mr-IN' | 'gu-IN';
  /** Language the TTS voice speaks in (the mixed clip is Hindi + English). */
  ttsLanguage: 'en-IN' | 'hi-IN' | 'mr-IN' | 'gu-IN';
  mixed: boolean;
  text: string;
  terms: Term[];
}

const T = {
  lft: { label: 'LFT', accept: ['lft', 'एलएफटी', 'एल एफ टी', 'એલએફટી'] },
  alt: { label: 'ALT', accept: ['alt', 'एएलटी', 'ए एल टी'] },
  ogd: { label: 'OGD', accept: ['ogd', 'ओजीडी', 'ओ जी डी'] },
  iop: { label: 'IOP', accept: ['iop', 'आयओपी', 'आईओपी', 'आय ओ पी', 'આઈઓપી', 'આઇઓપી'] },
  fundus: { label: 'fundus', accept: ['fundus', 'फंडस', 'फंडस्', 'ફંડસ'] },
  pantoprazole: {
    label: 'pantoprazole',
    accept: ['pantoprazole', 'पैंटोप्राज़ोल', 'पैंटोप्राजोल', 'पेंटोप्राजोल', 'पैन्टोप्राज़ोल'],
  },
  udca: {
    label: 'ursodeoxycholic acid',
    accept: ['ursodeoxycholic', 'उर्सोडिऑक्सीकोलिक', 'उर्सोडीऑक्सीकोलिक', 'उरसोडिऑक्सीकोलिक'],
  },
  timolol: { label: 'timolol', accept: ['timolol', 'टिमोलॉल', 'टिमोलोल', 'ટિમોલોલ'] },
  ultrasound: { label: 'ultrasound', accept: ['ultrasound', 'अल्ट्रासाउंड'] },
} satisfies Record<string, Term>;

export const CLIPS: Clip[] = [
  {
    id: 'en-gastro',
    language: 'en-IN',
    ttsLanguage: 'en-IN',
    mixed: false,
    text:
      'Patient complains of epigastric pain for two weeks. LFT shows raised ALT of ninety four. ' +
      'Plan OGD next week. Start pantoprazole forty milligrams once daily before breakfast ' +
      'and ursodeoxycholic acid three hundred milligrams twice a day.',
    terms: [T.lft, T.alt, T.ogd, T.pantoprazole, T.udca],
  },
  {
    id: 'hi-gastro',
    language: 'hi-IN',
    ttsLanguage: 'hi-IN',
    mixed: false,
    text:
      'मरीज़ को दो हफ़्ते से पेट के ऊपरी हिस्से में दर्द है। एलएफटी में एएलटी बढ़ा हुआ है। ' +
      'अगले हफ़्ते ओजीडी करवाएँगे। पैंटोप्राज़ोल चालीस मिलीग्राम रोज़ सुबह नाश्ते से पहले लेना है।',
    terms: [T.lft, T.alt, T.ogd, T.pantoprazole],
  },
  {
    id: 'mr-eye',
    language: 'mr-IN',
    ttsLanguage: 'mr-IN',
    mixed: false,
    text:
      'रुग्णाच्या डाव्या डोळ्याचा आयओपी बावीस आहे. फंडस तपासणीत कप डिस्क रेशो वाढलेला आहे. ' +
      'टिमोलॉल डोळ्यात दिवसातून दोन वेळा घालावे. एक महिन्यानंतर पुन्हा तपासणी.',
    terms: [T.iop, T.fundus, T.timolol],
  },
  {
    id: 'gu-eye',
    language: 'gu-IN',
    ttsLanguage: 'gu-IN',
    mixed: false,
    text:
      'દર્દીની જમણી આંખમાં ઝાંખું દેખાય છે. આઈઓપી અઢાર છે. ફંડસ સામાન્ય છે. ' +
      'મોતિયાનું ઓપરેશન આવતા મહિને કરીશું. ટિમોલોલ દિવસમાં બે વાર નાખવું.',
    terms: [T.iop, T.fundus, T.timolol],
  },
  {
    id: 'mixed-hi-en',
    language: 'hi-IN',
    ttsLanguage: 'hi-IN',
    mixed: true,
    text:
      'पेशेंट को तीन दिन से fever है, LFT normal है but ultrasound में fatty liver दिखा, ' +
      'so start ursodeoxycholic acid three hundred mg twice daily और OGD next week करेंगे।',
    terms: [T.lft, T.ultrasound, T.udca, T.ogd],
  },
];

/** Terms sent as Sarvam `keyterms` (saaras:v4 only; max 50, 64 chars each). */
export const KEYTERMS = [
  'LFT',
  'ALT',
  'OGD',
  'IOP',
  'fundus',
  'pantoprazole',
  'ursodeoxycholic acid',
  'timolol',
  'cup disc ratio',
  'epigastric',
];
