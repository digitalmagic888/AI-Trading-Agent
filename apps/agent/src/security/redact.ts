const secretNamePattern = /(api[_-]?key|secret|token|password|private[_-]?key|mnemonic|seed|hmac|authorization)/i;
const bearerPattern = /Bearer\s+[A-Za-z0-9._~+\/-]+=*/gi;
const assignmentPattern = /([A-Z0-9_]*(?:API_KEY|SECRET|TOKEN|PASSWORD|PRIVATE_KEY|MNEMONIC|SEED|HMAC)[A-Z0-9_]*\s*[=:]\s*)([^\s,"']+)/gi;

export function redactSecrets(input: unknown): unknown {
  if (typeof input === "string") {
    return input.replace(bearerPattern, "Bearer <redacted>").replace(assignmentPattern, "$1<redacted>");
  }
  if (Array.isArray(input)) return input.map((item) => redactSecrets(item));
  if (input && typeof input === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      output[key] = secretNamePattern.test(key) ? "<redacted>" : redactSecrets(value);
    }
    return output;
  }
  return input;
}

export function redactForLog(input: unknown): string {
  return JSON.stringify(redactSecrets(input), null, 2);
}
