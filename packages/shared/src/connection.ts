import { useConvex } from "convex/react";
import { useEffect, useState } from "react";

// True while the WebSocket to Convex is open.
// Both apps show an offline banner and block edits while this is false.
export function useIsOnline(): boolean {
  const convex = useConvex();
  const [online, setOnline] = useState(
    () => convex.connectionState().isWebSocketConnected,
  );
  useEffect(() => {
    setOnline(convex.connectionState().isWebSocketConnected);
    return convex.subscribeToConnectionState((s) =>
      setOnline(s.isWebSocketConnected),
    );
  }, [convex]);
  return online;
}
