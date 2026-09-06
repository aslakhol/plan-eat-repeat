import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import * as React from "react";
import { act } from "react";
import { parseHTML } from "linkedom";

import {
  KeepScreenAwakeProvider,
  useDinnerWakeLock,
  useKeepScreenAwakePreference,
} from "./use-keep-screen-awake";

async function flushReact(action: () => void | Promise<void>) {
  await act(async () => {
    await action();
  });
}

class Lock extends EventTarget {
  released = false;
  release = () => {
    if (!this.released) {
      this.released = true;
      this.dispatchEvent(new Event("release"));
    }
    return Promise.resolve();
  };
}

function deferredLock() {
  let resolve!: (lock: Lock) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<Lock>((accept, deny) => {
    resolve = accept;
    reject = deny;
  });
  return { promise, resolve, reject };
}

async function setup(t: TestContext) {
  const { document, window } = parseHTML(
    "<!doctype html><html><body><div id=app></div></body></html>",
  );
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const globals = {
    React,
    document,
    window,
    IS_REACT_ACT_ENVIRONMENT: true,
  };
  const restoreGlobals: (() => void)[] = [];
  for (const [key, value] of Object.entries(globals)) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, value });
    restoreGlobals.push(() => {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    });
  }
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: "visible",
  });
  const locks: Lock[] = [];
  const request = t.mock.fn(() => {
    const lock = new Lock();
    locks.push(lock);
    return Promise.resolve(lock);
  });
  Object.defineProperty(navigator, "wakeLock", {
    configurable: true,
    value: { request },
  });
  restoreGlobals.push(() => {
    Reflect.deleteProperty(navigator, "wakeLock");
  });

  let setEnabled!: (enabled: boolean) => void;
  function Dinner({ open }: { open: boolean }) {
    useDinnerWakeLock(open);
    setEnabled = useKeepScreenAwakePreference().setEnabled;
    return null;
  }
  const { createRoot } = await import("react-dom/client");
  const root = createRoot(document.querySelector("#app")!);
  t.after(async () => {
    await flushReact(() => root.unmount());
    restoreGlobals.forEach((restore) => restore());
  });
  const render = async (open: boolean) => {
    await flushReact(() => {
      root.render(
        <KeepScreenAwakeProvider>
          <Dinner open={open} />
        </KeepScreenAwakeProvider>,
      );
    });
  };
  const visibility = async (value: "hidden" | "visible") => {
    await flushReact(() => {
      Object.defineProperty(document, "visibilityState", { value });
      document.dispatchEvent(new window.Event("visibilitychange"));
    });
  };
  const tick = async (milliseconds = 1_000) => {
    await flushReact(() => t.mock.timers.tick(milliseconds));
  };
  return {
    locks,
    request,
    render,
    visibility,
    tick,
    disable: () => flushReact(() => setEnabled(false)),
    unmount: () => flushReact(() => root.unmount()),
    active: () => locks.filter((lock) => !lock.released).length,
  };
}

void test("restores a browser-released lock while the Dinner stays open", async (t) => {
  const app = await setup(t);
  await app.render(true);
  assert.equal(app.active(), 1);
  await flushReact(() => app.locks[0]!.release());
  await app.tick();
  assert.equal(app.active(), 1, "the open recipe must regain its wake lock");
  await app.tick(60_000);
  assert.equal(
    app.request.mock.callCount(),
    2,
    "an active lock needs no retries",
  );
});

void test("recovers when a pending request rejects after returning to the recipe", async (t) => {
  const app = await setup(t);
  const pending = deferredLock();
  app.request.mock.mockImplementationOnce(() => pending.promise);
  await app.render(true);
  await app.visibility("hidden");
  await app.visibility("visible");
  await flushReact(() => pending.reject(new Error("Document was hidden")));
  await app.tick();
  assert.equal(
    app.active(),
    1,
    "returning to the recipe must regain a wake lock",
  );
});

void test("ordinary visibility changes and closing release and restore the lock", async (t) => {
  const app = await setup(t);
  await app.render(true);
  assert.equal(app.active(), 1);
  await app.visibility("hidden");
  assert.equal(app.active(), 0);
  await app.visibility("visible");
  assert.equal(app.active(), 1);
  await app.render(false);
  await app.tick(60_000);
  assert.equal(app.active(), 0);
  assert.equal(app.request.mock.callCount(), 2);
});

void test("temporary denial backs off and recovers without a visibility change", async (t) => {
  const app = await setup(t);
  app.request.mock.mockImplementation(() =>
    Promise.reject(new Error("Battery saver temporarily denied the lock")),
  );
  await app.render(true);
  assert.equal(app.active(), 0);
  for (const delay of [1_000, 2_000, 4_000, 8_000, 16_000, 30_000, 30_000]) {
    const calls = app.request.mock.callCount();
    await app.tick(delay - 1);
    assert.equal(app.request.mock.callCount(), calls);
    await app.tick(1);
    assert.equal(app.request.mock.callCount(), calls + 1);
  }
  app.request.mock.restore();
  await app.tick(30_000);
  assert.equal(app.active(), 1);
});

for (const stop of ["close", "disable", "hide", "unmount"] as const) {
  void test(`${stop} cancels retries after the browser releases a lock`, async (t) => {
    const app = await setup(t);
    await app.render(true);
    await flushReact(() => app.locks[0]!.release());
    if (stop === "close") await app.render(false);
    if (stop === "disable") await app.disable();
    if (stop === "hide") await app.visibility("hidden");
    if (stop === "unmount") await app.unmount();
    await app.tick(60_000);
    assert.equal(app.active(), 0);
    assert.equal(app.request.mock.callCount(), 1);
  });
}

void test("a late grant from a closed sheet cannot replace the reopened sheet's lock", async (t) => {
  const app = await setup(t);
  const pending = deferredLock();
  app.request.mock.mockImplementationOnce(() => pending.promise);
  await app.render(true);
  await app.render(false);
  await app.render(true);
  assert.equal(app.active(), 1);
  const stale = new Lock();
  await flushReact(() => pending.resolve(stale));
  assert.equal(stale.released, true);
  assert.equal(app.active(), 1);
  await app.render(false);
  assert.equal(app.active(), 0);
});

void test("retries if the browser returns an already released lock", async (t) => {
  const app = await setup(t);
  app.request.mock.mockImplementationOnce(async () => {
    const lock = new Lock();
    await lock.release();
    return lock;
  });
  await app.render(true);
  await app.tick();
  assert.equal(app.active(), 1);
});

void test("unsupported browsers do not request or retry wake locks", async (t) => {
  const app = await setup(t);
  Reflect.deleteProperty(navigator, "wakeLock");
  await app.render(true);
  await app.tick(60_000);
  await app.visibility("hidden");
  await app.visibility("visible");
  assert.equal(app.request.mock.callCount(), 0);
});
