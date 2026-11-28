import { Directory, File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

/**
 * A4 PDFs on the phone (DIG-73). Kept in the app's cache only (the system may clear it); file
 * names carry the visit id and version, never the patient's name.
 */
const folder = () => {
  const dir = new Directory(Paths.cache, 'summaries');
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
};

export async function savePdf(bytes: Uint8Array, name: string): Promise<string> {
  const file = new File(folder(), name);
  if (file.exists) file.delete();
  file.create();
  await file.write(bytes);
  return file.uri;
}

/** The Android share sheet: WhatsApp, email, Drive, "Save to device". */
export async function sharePdf(uri: string): Promise<void> {
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Share consultation summary' });
}

/** Android's print screen, which can also save the PDF. */
export async function printPdf(uri: string): Promise<void> {
  await Print.printAsync({ uri });
}

/** Clears saved summaries, e.g. on sign-out. */
export function clearPdfs(): void {
  const dir = new Directory(Paths.cache, 'summaries');
  if (dir.exists) dir.delete();
}
