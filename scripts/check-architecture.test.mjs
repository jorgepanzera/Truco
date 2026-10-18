import assert from "node:assert/strict";
import { test } from "node:test";
import { checkManifest, checkSource } from "./check-architecture.mjs";

const analyze = (text, name = "game-engine") =>
  checkSource(name, "fixture.ts", text, (value) => value === "./local.js");

test("permite shared y archivos locales", () => {
  assert.deepEqual(
    analyze('import type { Carta } from "@truco/shared"; export * from "./local.js";'),
    [],
  );
});

test("rechaza imports, reexports y dependencias dinámicas prohibidas", () => {
  for (const text of [
    'import "react"',
    'import "node:fs"',
    'export * from "@prisma/client"',
    'import("ws")',
    'import("../../apps/web/src/index.js")',
    'import type { X } from "@truco/server"',
    'type T = import("node:http").Server',
    "import(value)",
    'require("sqlite3")',
    'require.resolve("react")',
    '/// <reference types="node" />\nexport {}',
  ])
    assert.notEqual(analyze(text).length, 0, text);
});

test("shared no puede depender del motor y se limita el manifiesto", () => {
  assert.notEqual(analyze('import "@truco/game-engine"', "shared").length, 0);
  assert.deepEqual(
    checkManifest("game-engine", { dependencies: { "@truco/shared": "0.0.0" } }),
    [],
  );
  assert.notEqual(checkManifest("game-engine", { dependencies: { react: "1" } }).length, 0);
  assert.notEqual(
    checkManifest("shared", { optionalDependencies: { "@truco/web": "1" } }).length,
    0,
  );
});
