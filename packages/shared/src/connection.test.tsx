import { act, cleanup, renderHook } from "@testing-library/react";
import { ConvexProvider } from "convex/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useIsOnline } from "./connection";
import { FakeSocket, newFakeClient } from "./fake-server";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function setup() {
  const client = newFakeClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ConvexProvider client={client}>{children}</ConvexProvider>
  );
  const view = renderHook(() => useIsOnline(), { wrapper });
  return { client, view };
}

describe("useIsOnline", () => {
  it("is false until the socket opens", async () => {
    const { client, view } = setup();
    expect(view.result.current).toBe(false);
    await act(async () => FakeSocket.current.open());
    expect(view.result.current).toBe(true);
    await client.close();
  });

  it("goes false when the socket drops", async () => {
    const { client, view } = setup();
    await act(async () => FakeSocket.current.open());
    expect(view.result.current).toBe(true);
    await act(async () => FakeSocket.current.drop());
    expect(view.result.current).toBe(false);
    await client.close();
  });

  it("goes true again after the client reconnects", async () => {
    vi.useFakeTimers();
    const { client, view } = setup();
    await act(async () => FakeSocket.current.open());
    await act(async () => FakeSocket.current.drop());
    expect(view.result.current).toBe(false);
    const first = FakeSocket.current;
    // The client waits a random backoff before it opens a new socket.
    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(FakeSocket.current).not.toBe(first);
    await act(async () => FakeSocket.current.open());
    expect(view.result.current).toBe(true);
    await client.close();
  });

  it("reads the state at mount when the socket is already open", async () => {
    const client = newFakeClient();
    FakeSocket.current.open();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ConvexProvider client={client}>{children}</ConvexProvider>
    );
    const view = renderHook(() => useIsOnline(), { wrapper });
    expect(view.result.current).toBe(true);
    await client.close();
  });

  it("unsubscribes on unmount", async () => {
    const client = newFakeClient();
    const unsubscribe = vi.fn();
    const subscribe = client.subscribeToConnectionState.bind(client);
    vi.spyOn(client, "subscribeToConnectionState").mockImplementation((cb) => {
      const stop = subscribe(cb);
      return () => {
        unsubscribe();
        stop();
      };
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ConvexProvider client={client}>{children}</ConvexProvider>
    );
    const view = renderHook(() => useIsOnline(), { wrapper });
    expect(unsubscribe).not.toHaveBeenCalled();
    view.unmount();
    expect(unsubscribe).toHaveBeenCalledOnce();
    // The client can only shut down once its socket has opened.
    FakeSocket.current.open();
    await client.close();
  });
});
