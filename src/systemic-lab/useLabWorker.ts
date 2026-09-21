import { useCallback, useEffect, useRef, useState } from "react";
import type { LabRequest } from "./worker";
export function useLabWorker() {
  const worker = useRef<Worker | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rejectPending = useRef<((error: Error) => void) | null>(null);

  const getWorker = useCallback(() => {
    if (!worker.current) {
      try {
        worker.current = new Worker(new URL("./worker.ts", import.meta.url), {
          type: "module",
        });
      } catch (err) {
        throw new Error(
          err instanceof Error ? err.message : "Worker initialization failed"
        );
      }
    }
    return worker.current;
  }, []);

  const cancel = useCallback(() => {
    if (worker.current) {
      worker.current.terminate();
      worker.current = null;
    }
    rejectPending.current?.(new Error("Experiment cancelled"));
    rejectPending.current = null;
    setBusy(false);
    setProgress(null);
  }, []);

  useEffect(
    () => () => {
      if (worker.current) {
        worker.current.terminate();
        worker.current = null;
      }
      rejectPending.current?.(new Error("Workspace closed"));
      rejectPending.current = null;
    },
    []
  );

  const run = useCallback(
    <T>(request: LabRequest): Promise<T> => {
      if (rejectPending.current) {
        rejectPending.current(new Error("Replaced by a new experiment"));
        rejectPending.current = null;
      }
      setBusy(true);
      setError(null);
      setProgress(null);

      return new Promise<T>((resolve, reject) => {
        let instance: Worker;
        try {
          instance = getWorker();
        } catch (err) {
          setBusy(false);
          const message = err instanceof Error ? err.message : "Worker failed";
          setError(message);
          reject(new Error(message));
          return;
        }

        rejectPending.current = reject;

        instance.onmessage = (e: MessageEvent) => {
          const message = e.data;
          if (message.kind === "progress") {
            setProgress(message.done / message.total);
            return;
          }
          rejectPending.current = null;
          setBusy(false);
          if (message.kind === "error") {
            setError(message.message);
            reject(new Error(message.message));
          } else {
            resolve(message.data as T);
          }
        };

        instance.onerror = () => {
          if (worker.current) {
            worker.current.terminate();
            worker.current = null;
          }
          setBusy(false);
          setError(
            "Worker could not execute the experiment. Check the scenario and browser support."
          );
          rejectPending.current = null;
          reject(new Error("Worker failed"));
        };

        instance.postMessage(request);
      });
    },
    [getWorker]
  );

  return { run, cancel, busy, progress, error };
}
