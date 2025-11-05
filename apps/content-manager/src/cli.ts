#!/usr/bin/env node

import path from "node:path";
import process from "node:process";

import type { ValidateScriptOptions } from "./scripts/validate.js";
import { runValidateScript } from "./scripts/validate.js";
import type { UploadScriptOptions } from "./scripts/upload.js";
import { runUploadScript } from "./scripts/upload.js";

const printUsage = (message?: string) => {
  if (message) {
    console.error(message);
  }

  console.error(`Usage:
  validate [--file <puzzle.json>]
  upload [--env <dev|prod>] [--file <puzzle.json>] [--dry-run]
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

type UploadCliOptions = UploadScriptOptions & {
  files: string[];
};

const parseUploadArgs = (args: string[]): UploadCliOptions => {
  const options: UploadCliOptions = { files: [] };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--file" || arg === "-f") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("Option '--file' expects a value.");
      }
      options.files.push(value);
      index += 1;
      continue;
    }

    if (arg === "--env" || arg === "-e") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("Option '--env' expects a value.");
      }
      if (value !== "dev" && value !== "prod") {
        throw new Error("Option '--env' must be either 'dev' or 'prod'.");
      }
      options.env = value;
      index += 1;
      continue;
    }

    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    throw new Error(`Unknown option '${arg}'.`);
  }

  return options;
};

const runUpload = async (args: string[]) => {
  let options: UploadCliOptions;
  try {
    options = parseUploadArgs(args);
  } catch (error) {
    printUsage((error as Error).message);
    process.exit(1);
    return;
  }

  try {
    const result = await runUploadScript({
      env: options.env,
      files: options.files.length > 0 ? options.files : undefined,
      dryRun: options.dryRun,
    });

    if (result.total === 0) {
      console.log("Nothing to upload.");
      return;
    }

    const uploadedCount = result.uploaded.length;
    const skippedCount = result.skipped.length;

    if (result.dryRun) {
      console.log(
        `Dry run: ${uploadedCount} puzzle${uploadedCount === 1 ? "" : "s"} would be uploaded to ${result.bucket}.`,
      );
    } else {
      console.log(
        `✅ Uploaded ${uploadedCount} puzzle${uploadedCount === 1 ? "" : "s"} to ${result.bucket}.`,
      );
      console.log(
        `   Skipped ${skippedCount} existing puzzle${skippedCount === 1 ? "" : "s"}.`,
      );
      console.log("   Updated manifest.json.");
    }

    if (result.remoteOnly.length > 0) {
      console.warn(
        `Warning: the bucket contains ${result.remoteOnly.length} puzzle${result.remoteOnly.length === 1 ? "" : "s"} that are not present locally.`,
      );
      result.remoteOnly.slice(0, 5).forEach((key) => console.warn(`   • ${key}`));
      if (result.remoteOnly.length > 5) {
        console.warn("   ...");
      }
    }
  } catch (error) {
    console.error((error as Error).message);
    process.exit(1);
  }
};

const main = async () => {
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

  if (script === "upload") {
    await runUpload(args);
    return;
  }

  printUsage(`Unknown script: ${script}`);
  process.exit(1);
};

void main();
