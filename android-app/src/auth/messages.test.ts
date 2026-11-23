import { signInErrorMessage, signOutMessage } from './messages';

describe('login messages', () => {
  it('explains why the doctor has to sign in again', () => {
    expect(signOutMessage('signed_out_remotely')).toMatch(/admin signed you out/);
    expect(signOutMessage('account_disabled')).toMatch(/turned off/);
    expect(signOutMessage('session_ended')).toMatch(/session has ended/);
    expect(signOutMessage('logged_out')).toBeNull();
    expect(signOutMessage(undefined)).toBeNull();
  });

  it.each([
    'wrong_credentials',
    'password_change_required',
    'too_many_attempts',
    'network',
    'not_configured',
    'not_doctor',
    'unknown',
  ] as const)('has a message for %s', (code) => {
    expect(signInErrorMessage(code).length).toBeGreaterThan(10);
  });
});
