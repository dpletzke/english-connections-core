#!/usr/bin/env node

import path from "node:path";
import process from "node:process";

import type { ValidateScriptOptions } from "./scripts/validate.js";
import { runValidateScript } from "./scripts/validate.js";

const printUsage = (message?: string) => {
  if (message) {
    console.error(message);
  }

  console.error(`Usage:
  validate [--file <puzzle.json>]
`);
};

const parseValidateArgs = (args: string[]): ValidateScriptOptions => {
  const files: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--file" || arg === "-f") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("Option '--file' expects a value.");
      }
      files.push(value);
      index += 1;
      continue;
    }

    throw new Error(`Unknown option '${arg}'.`);
  }

  return { files };
};

const runValidate = (args: string[]) => {
  let options: ValidateScriptOptions;
  try {
    options = parseValidateArgs(args);
  } catch (error) {
    printUsage((error as Error).message);
    process.exit(1);
    return;
  }

  let result;
  try {
    result = runValidateScript(options);
  } catch (error) {
    console.error((error as Error).message);
    process.exit(1);
    return;
  }

  if (result.filesChecked.length === 0) {
    console.log("Nothing to validate.");
    return;
  }

  if (result.issues.length === 0) {
    console.log(
      `✅ ${result.filesChecked.length} puzzle${result.filesChecked.length === 1 ? "" : "s"} validated`,
    );
    return;
  }

  console.error("❌ Validation failed:\n");
  for (const issue of result.issues) {
    const relativePath = path.relative(process.cwd(), issue.file) || issue.file;
    const location = issue.field
      ? `${relativePath} (${issue.field})`
      : relativePath;
    console.error(`  • ${location}: ${issue.message}`);
  }

  console.error(
    `\nFound ${result.issues.length} issue${result.issues.length === 1 ? "" : "s"} across ${result.filesChecked.length} puzzle${result.filesChecked.length === 1 ? "" : "s"}.`,
  );
  process.exit(1);
};

const main = () => {
  const [, , script, ...args] = process.argv;

  if (!script) {
    printUsage("Missing script name.");
    process.exit(1);
    return;
  }

  if (script === "validate") {
    runValidate(args);
    return;
  }

  printUsage(`Unknown script: ${script}`);
  process.exit(1);
};

main();
