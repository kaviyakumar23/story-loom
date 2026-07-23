/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Test harness for Inngest functions. Pair it with a mock of the pipeline client
 * whose `createFunction` just captures the handler:
 *
 *   vi.mock('@/server/pipeline/client', () => ({
 *     inngest: { createFunction: (_cfg, handler) => ({ handler }), send: async (e) => { sends.push(e); } },
 *     EVENTS: { ... },
 *   }));
 *
 * Then drive the handler with a fake `step` that runs each step inline:
 *
 *   await handlerOf(myCron)({ step: makeStep() });
 */
export interface FakeStep {
  run: <T>(name: string, fn: () => Promise<T> | T) => Promise<T>;
  sleep: (name: string, ms?: number) => Promise<void>;
}

/** A `step` that executes each `step.run` inline (memoization is irrelevant in tests). */
export function makeStep(): FakeStep {
  return {
    run: (_name, fn) => Promise.resolve(fn()),
    sleep: async () => {},
  };
}

type Handler = (arg: { event?: any; step: FakeStep }) => Promise<any>;

/** Pull the captured handler off an Inngest function mocked to `{ handler }`. */
export function handlerOf(fn: unknown): Handler {
  return (fn as { handler: Handler }).handler;
}
