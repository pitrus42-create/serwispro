export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

export const PASSWORD_POLICY = {
  minLength: 8,
  requireUppercase: true,
  requireDigit: true,
  requireSpecial: true,
} as const;

export function validatePasswordStrength(
  password: string
): PasswordValidationResult {
  const errors: string[] = [];

  if (password.length < PASSWORD_POLICY.minLength) {
    errors.push(`Minimum ${PASSWORD_POLICY.minLength} znaków`);
  }
  if (PASSWORD_POLICY.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push("Co najmniej jedna wielka litera");
  }
  if (PASSWORD_POLICY.requireDigit && !/[0-9]/.test(password)) {
    errors.push("Co najmniej jedna cyfra");
  }
  if (PASSWORD_POLICY.requireSpecial && !/[^A-Za-z0-9]/.test(password)) {
    errors.push("Co najmniej jeden znak specjalny (np. !@#$%^&*)");
  }

  return { valid: errors.length === 0, errors };
}
