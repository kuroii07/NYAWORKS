import { describe, expect, it } from "vitest";
import { createDevelopmentAiFetcher } from "../src/aiSettings/developmentFixtures";

describe("AI development fixtures", () => {
  it("returns deterministic model data for approved fixtures", async () => {
    const fetcher = createDevelopmentAiFetcher("?aiFixture=models");

    expect(fetcher).toBeTypeOf("function");
    const response = await fetcher!("https://example.com/models");
    expect(response.ok).toBe(true);
    expect(await response.json()).toEqual({
      data: [
        { id: "deepseek-chat" },
        { id: "deepseek-reasoner" },
        { id: "nyaworks-preview" }
      ]
    });
  });

  it("maps connected and invalid-key fixtures to explicit responses", async () => {
    const connected = createDevelopmentAiFetcher("?aiFixture=connected");
    const invalid = createDevelopmentAiFetcher("?aiFixture=invalid-key");

    expect((await connected!("https://example.com/models")).status).toBe(200);
    expect((await invalid!("https://example.com/models")).status).toBe(401);
  });

  it("throws an AbortError for the timeout fixture", async () => {
    const fetcher = createDevelopmentAiFetcher("?aiFixture=timeout");

    await expect(fetcher!("https://example.com/models")).rejects.toMatchObject({
      name: "AbortError"
    });
  });

  it("ignores unknown fixtures and never reads a key from the query string", () => {
    expect(createDevelopmentAiFetcher("?aiFixture=unknown")).toBeUndefined();
    expect(
      createDevelopmentAiFetcher("?aiFixture=models&apiKey=secret")
    ).toBeTypeOf("function");
  });
});
