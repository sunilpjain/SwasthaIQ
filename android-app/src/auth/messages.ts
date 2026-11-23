import type { CognitoErrorCode } from './cognito';
import type { SignOutReason } from './session';

/** Why the login screen is showing (none for a first login or after Log out). */
export function signOutMessage(reason: SignOutReason | undefined): string | null {
  switch (reason) {
    case 'signed_out_remotely':
      return 'The clinic admin signed you out. Please sign in again.';
    case 'account_disabled':
      return 'Your account is turned off. Please contact the clinic admin.';
    case 'session_ended':
      return 'Your session has ended. Please sign in again.';
    default:
      return null;
  }
}

export function signInErrorMessage(code: CognitoErrorCode | 'not_doctor'): string {
  switch (code) {
    case 'wrong_credentials':
      return 'Wrong user ID or password.';
    case 'password_change_required':
      return 'Your password must be set by the clinic admin first.';
    case 'too_many_attempts':
      return 'Too many attempts. Wait a minute and try again.';
    case 'network':
      return 'No connection. Check the internet and try again.';
    case 'not_configured':
      return 'Sign-in is not set up for this build yet.';
    case 'not_doctor':
      return 'This app is for doctors. Please use the admin dashboard.';
    default:
      return 'Sign-in failed. Please try again.';
  }
}
