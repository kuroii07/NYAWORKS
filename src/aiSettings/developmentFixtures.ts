type DevelopmentAiFixture =
  | "connected"
  | "models"
  | "invalid-key"
  | "timeout";

const DEVELOPMENT_AI_FIXTURES = new Set<DevelopmentAiFixture>([
  "connected",
  "models",
  "invalid-key",
  "timeout"
]);

const MODEL_FIXTURE = {
  data: [
    { id: "deepseek-chat" },
    { id: "deepseek-reasoner" },
    { id: "nyaworks-preview" }
  ]
};

function jsonResponse(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

function parseFixture(search: string): DevelopmentAiFixture | null {
  const fixture = new URLSearchParams(search).get("aiFixture");

  return fixture && DEVELOPMENT_AI_FIXTURES.has(fixture as DevelopmentAiFixture)
    ? (fixture as DevelopmentAiFixture)
    : null;
}

export function createDevelopmentAiFetcher(
  search: string
): typeof fetch | undefined {
  const fixture = parseFixture(search);

  if (!fixture) {
    return undefined;
  }

  return async () => {
    if (fixture === "timeout") {
      const error = new Error("Development fixture timeout");
      error.name = "AbortError";
      throw error;
    }

    if (fixture === "invalid-key") {
      return jsonResponse({ error: { code: "invalid_api_key" } }, 401);
    }

    return jsonResponse(MODEL_FIXTURE, 200);
  };
}
