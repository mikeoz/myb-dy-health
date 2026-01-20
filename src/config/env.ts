/**
 * Environment Variable Configuration
 * 
 * GUARDRAIL: Server-only secrets
 * - No private keys, API secrets, or tokens may appear in client code
 * - All secrets are referenced via environment variables
 * - These placeholders define the expected environment variables
 * 
 * NOTE: These are NOT populated in the client bundle.
 * Actual values must be set in the server environment (edge functions).
 */

/**
 * Environment variable names used by MyBödy.
 * These are placeholders - actual values are set server-side only.
 */
export const ENV_KEYS = {
  /**
   * Fasten Health API key for external healthcare data access.
   * Server-only - never expose to client.
   */
  FASTEN_API_KEY: 'FASTEN_API_KEY',

  /**
   * Fasten Health private key for signing requests.
   * Server-only - never expose to client.
   */
  FASTEN_PRIVATE_KEY: 'FASTEN_PRIVATE_KEY',

  /**
   * Fasten Health webhook secret for verifying incoming webhooks.
   * Server-only - never expose to client.
   */
  FASTEN_WEBHOOK_SECRET: 'FASTEN_WEBHOOK_SECRET',

  /**
   * Application environment identifier.
   * Values: 'development' | 'staging' | 'production'
   */
  APP_ENV: 'APP_ENV',
} as const;

/**
 * Type for environment variable keys.
 */
export type EnvKey = keyof typeof ENV_KEYS;

/**
 * Check if we're in development mode.
 * This is the ONLY environment check allowed in client code.
 */
export const isDevelopment = (): boolean => {
  // TODO: Connect to actual environment detection via edge function
  return import.meta.env.DEV;
};

/**
 * GUARDRAIL REMINDER:
 * 
 * When implementing edge functions that use these environment variables:
 * 1. Access via Deno.env.get(ENV_KEYS.FASTEN_API_KEY)
 * 2. Never return raw secrets in responses
 * 3. Log only that a secret was accessed, not its value
 */
