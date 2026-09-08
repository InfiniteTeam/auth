#!/usr/bin/env node
import { fileURLToPath } from "node:url";

async function run() {
  const entry = fileURLToPath(new URL("../dist/index.js", import.meta.url));
  await import(entry);
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});