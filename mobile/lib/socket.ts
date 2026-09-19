import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { API_BASE_URL } from "./config";
import { GateEventPayload } from "./types";

let sharedSocket: Socket | null = null;

function getSocket(): Socket {
  if (!sharedSocket) {
    sharedSocket = io(API_BASE_URL, { transports: ["websocket"] });
  }
  return sharedSocket;
}

/** Subscribes to live gate events for the lifetime of the calling component. */
export function useGateEvents(onEvent: (event: GateEventPayload) => void) {
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  useEffect(() => {
    const socket = getSocket();
    const handler = (event: GateEventPayload) => handlerRef.current(event);
    socket.on("gate_event", handler);
    return () => {
      socket.off("gate_event", handler);
    };
  }, []);
}
