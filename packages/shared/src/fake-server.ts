import { ConvexReactClient } from "convex/react";

// A stand-in for the Convex WebSocket, for tests.
// The real ConvexReactClient talks to it, so optimistic updates run
// through the real client code. The fake server speaks just enough of
// the sync protocol: it records what the client sends, and it pushes
// query results and mutation results back.

type Sent = { type: string; [key: string]: unknown };

// Convex encodes a timestamp as 8 little-endian bytes in base64.
function encodeTs(n: number): string {
  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setUint32(0, n, true);
  return btoa(String.fromCharCode(...bytes));
}

export class FakeSocket {
  static instances: FakeSocket[] = [];
  static reset() {
    FakeSocket.instances = [];
  }
  static get current(): FakeSocket {
    const socket = FakeSocket.instances.at(-1);
    if (!socket) throw new Error("The client has not opened a socket.");
    return socket;
  }

  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: { code: number; reason: string }) => void) | null = null;
  onerror: ((event: { message?: string }) => void) | null = null;
  readyState = 0;
  sent: Sent[] = [];

  private querySetVersion = 0;
  private ts = 0;
  // The version the client has after the last transition.
  private version = { querySet: 0, ts: encodeTs(0), identity: 0 };
  private queries = new Map<number, string>();

  constructor(readonly url: string) {
    FakeSocket.instances.push(this);
  }

  send(data: string) {
    const message = JSON.parse(data) as Sent;
    this.sent.push(message);
    if (message.type === "ModifyQuerySet") {
      this.querySetVersion = message.newVersion as number;
      for (const mod of message.modifications as {
        type: string;
        queryId: number;
        udfPath: string;
      }[]) {
        if (mod.type === "Add") this.queries.set(mod.queryId, mod.udfPath);
        else this.queries.delete(mod.queryId);
      }
    }
  }

  // The client waits for the close event when it shuts down.
  close() {
    this.readyState = 3;
    queueMicrotask(() => this.onclose?.({ code: 1000, reason: "" }));
  }

  // Mutation requests the client sent, in order.
  mutations(udfPath: string) {
    return this.sent.filter(
      (m) => m.type === "Mutation" && m.udfPath === udfPath,
    ) as unknown as { requestId: number; args: unknown[] }[];
  }

  open() {
    this.readyState = 1;
    this.onopen?.();
  }

  drop(code = 1006) {
    this.readyState = 3;
    this.onclose?.({ code, reason: "" });
  }

  // Sends a new result for every active query on `udfPath`.
  setQuery(udfPath: string, value: unknown) {
    const modifications = [...this.queries]
      .filter(([, path]) => path === udfPath)
      .map(([queryId]) => ({
        type: "QueryUpdated",
        queryId,
        value,
        logLines: [],
        journal: null,
      }));
    if (modifications.length === 0) {
      throw new Error(`No active query for ${udfPath}.`);
    }
    const startVersion = this.version;
    this.ts += 1;
    const endVersion = {
      querySet: this.querySetVersion,
      ts: encodeTs(this.ts),
      identity: 0,
    };
    this.version = endVersion;
    this.receive({
      type: "Transition",
      startVersion,
      endVersion,
      modifications,
    });
  }

  // Fails a mutation. The client drops its optimistic update.
  failMutation(requestId: number, message: string) {
    this.receive({
      type: "MutationResponse",
      requestId,
      success: false,
      result: message,
      logLines: [],
    });
  }

  private receive(message: object) {
    this.onmessage?.({ data: JSON.stringify(message) });
  }
}

// The socket is not open yet. Call `FakeSocket.current.open()` to open it.
export function newFakeClient(): ConvexReactClient {
  FakeSocket.reset();
  const client = new ConvexReactClient("https://fake.convex.cloud", {
    webSocketConstructor: FakeSocket as unknown as typeof WebSocket,
    unsavedChangesWarning: false,
    logger: false,
  });
  // The client creates its socket on first use. Force that now.
  client.connectionState();
  return client;
}
