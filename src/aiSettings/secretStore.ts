export interface AiSecretStore {
  readonly persistence: "session";
  save(connectionId: string, secret: string): Promise<string>;
  has(reference: string): Promise<boolean>;
  readForRequest(reference: string): Promise<string>;
  remove(reference: string): Promise<void>;
  clear(): Promise<void>;
}

function createOpaqueReference(connectionId: string): string {
  const randomPart =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

  return `session:${encodeURIComponent(connectionId)}:${randomPart}`;
}

export function createMemoryAiSecretStore(): AiSecretStore {
  const secrets = new Map<string, string>();
  const connectionReferences = new Map<string, string>();

  return Object.freeze({
    persistence: "session" as const,

    async save(connectionId: string, secret: string) {
      const normalizedConnectionId = connectionId.trim();
      const normalizedSecret = secret.trim();

      if (!normalizedConnectionId || !normalizedSecret) {
        throw new Error("Connection ID and secret are required");
      }

      const previousReference = connectionReferences.get(normalizedConnectionId);

      if (previousReference) {
        secrets.delete(previousReference);
      }

      const reference = createOpaqueReference(normalizedConnectionId);
      connectionReferences.set(normalizedConnectionId, reference);
      secrets.set(reference, normalizedSecret);
      return reference;
    },

    async has(reference: string) {
      return secrets.has(reference);
    },

    async readForRequest(reference: string) {
      const secret = secrets.get(reference);

      if (!secret) {
        throw new Error("AI secret is unavailable");
      }

      return secret;
    },

    async remove(reference: string) {
      secrets.delete(reference);

      for (const [connectionId, storedReference] of connectionReferences) {
        if (storedReference === reference) {
          connectionReferences.delete(connectionId);
          break;
        }
      }
    },

    async clear() {
      secrets.clear();
      connectionReferences.clear();
    }
  });
}

export const sessionAiSecretStore = createMemoryAiSecretStore();
