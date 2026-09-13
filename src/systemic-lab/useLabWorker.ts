import { useCallback, useEffect, useRef, useState } from "react";
import type { LabRequest } from "./worker";
export function useLabWorker() {
  const worker = useRef<Worker | null>(null);
  const [busy, setBusy] = useState(false),
    [progress, setProgress] = useState<number | null>(null),
    [error, setError] = useState<string | null>(null);
  const rejectPending = useRef<((error: Error) => void) | null>(null);
  const cancel = useCallback(() => {
    worker.current?.terminate();
    worker.current = null;
    rejectPending.current?.(new Error("Experiment cancelled"));
    rejectPending.current = null;
    setBusy(false);
    setProgress(null);
  }, []);
  useEffect(
    () => () => {
      worker.current?.terminate();
      rejectPending.current?.(new Error("Workspace closed"));
    },
    [],
  );
  const run = useCallback(<T>(request: LabRequest): Promise<T> => {
    worker.current?.terminate();
    rejectPending.current?.(new Error("Replaced by a new experiment"));
    setBusy(true);
    setError(null);
    setProgress(null);
    return new Promise<T>((resolve, reject) => {
      let instance: Worker;
      try {
        instance = new Worker(new URL("./worker.ts", import.meta.url), {
          type: "module",
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Worker initialization failed";
        setBusy(false);
        setError(message);
        reject(new Error(message));
        return;
      }
      worker.current = instance;
      rejectPending.current = reject;
      instance.onmessage = (e: MessageEvent) => {
        const message = e.data;
        if (message.kind === "progress") {
          setProgress(message.done / message.total);
          return;
        }
        instance.terminate();
        worker.current = null;
        rejectPending.current = null;
        setBusy(false);
        if (message.kind === "error") {
          setError(message.message);
          reject(new Error(message.message));
        } else resolve(message.data as T);
      };
      instance.onerror = () => {
        instance.terminate();
        worker.current = null;
        setBusy(false);
        setError(
          "Worker could not execute the experiment. Check the scenario and browser support.",
        );
        rejectPending.current = null;
        reject(new Error("Worker failed"));
      };
      instance.postMessage(request);
    });
  }, []);
  return { run, cancel, busy, progress, error };
}
