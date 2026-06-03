import { describe, expect, it } from "vitest";
import { redactSecrets } from "../src/security/redact";

describe("redactSecrets", () => {
  it("redacts secret-looking keys and bearer tokens", () => {
    const redacted = redactSecrets({ apiKey: "abc", nested: { token: "def", message: "Authorization=Bearer xyz" } });
    expect(redacted).toEqual({ apiKey: "<redacted>", nested: { token: "<redacted>", message: "Authorization=Bearer <redacted>" } });
  });
});
