// --- identity: authentication (KUR-66, replaces Better Auth) ---
export type { PasswordHasher } from '../ports/password-hasher'
export { InvalidToken, type TokenSigner } from '../ports/token-signer'
export {
  EmailAlreadyRegistered,
  type CredentialRepository,
} from '../ports/credential-repository'
export type {
  NewRefreshToken,
  RefreshTokenRepository,
} from '../ports/refresh-token-repository'
export {
  OAuthExchangeFailed,
  OAuthStateMismatch,
  type AuthorizationRequest,
  type ExternalUser,
  type OAuthProvider,
} from '../ports/oauth-provider'
export type { SecretGenerator, TotpPort } from '../ports/totp'
export {
  SessionIssuer,
  type SessionIssuerDeps,
  type SessionTokens,
} from './issue-session'
export {
  RegisterUser,
  RegistrationThrottled,
  type RegisterInput,
  type RegisterResult,
} from './register-user'
export {
  SignInFailed,
  SignInWithPassword,
  TooManyAttempts,
  type SignInInput,
  type SignInOutcome,
} from './sign-in-with-password'
export {
  CompleteSecondFactor,
  SecondFactorThrottled,
  type SecondFactorInput,
} from './complete-second-factor'
export {
  RefreshSession,
  SessionNotRefreshable,
  type RefreshInput,
} from './refresh-session'
export { SignOut, type SignOutInput } from './sign-out'
export {
  ProviderAccountUnusable,
  SignInWithProvider,
  type ProviderSignInInput,
} from './sign-in-with-provider'
export {
  CompleteOAuthSignIn,
  type CompleteOAuthInput,
} from './complete-oauth-sign-in'
