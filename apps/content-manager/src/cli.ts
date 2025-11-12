#!/usr/bin/env node

import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

import type { PromoteScriptOptions } from "./scripts/promote.js";
import { runPromoteScript } from "./scripts/promote.js";
import type { UploadScriptOptions } from "./scripts/upload.js";
import { runUploadScript } from "./scripts/upload.js";
import type { ValidateScriptOptions } from "./scripts/validate.js";
import { runValidateScript } from "./scripts/validate.js";

const DIST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(DIST_DIR, "..", "..", "..");
const DOTENV_PATH = path.join(REPO_ROOT, ".env");

dotenv.config({ path: DOTENV_PATH });

const printUsage = (message?: string) => {
  if (message) {
    console.error(message);
  }

  console.error(`Usage:
  validate [--file <puzzle.json>]
  upload [--env <dev|prod>] [--file <puzzle.json>] [--dry-run]
  promote [--source <dev|prod>] [--target <dev|prod>] [--overwrite] [--dry-run]
`);
};

const parseEnvTarget = (value: string): "dev" | "prod" => {
  if (value === "dev" || value === "prod") {
    return value;
  }
  throw new Error("Environment must be either 'dev' or 'prod'.");
};

const readDefaultEnvTarget = (): "dev" | "prod" | undefined => {
  const raw = process.env.ECON_CONTENT_DEFAULT_ENV;
  if (!raw) {
    return undefined;
  }
  try {
    return parseEnvTarget(raw.trim());
  } catch (error) {
    throw new Error(
      "Invalid ECON_CONTENT_DEFAULT_ENV value. Expected 'dev' or 'prod'.",
    );
  }
};

const parseBoolean = (value: string): boolean => {
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  throw new Error(
    "Invalid boolean value. Use one of: true, false, yes, no, on, off, 1, 0.",
  );
};

const readDefaultDryRun = (): boolean | undefined => {
  const raw = process.env.ECON_CONTENT_DEFAULT_DRY_RUN;
  if (!raw) {
    return undefined;
  }
  try {
    return parseBoolean(raw);
  } catch (error) {
    throw new Error(
      "Invalid ECON_CONTENT_DEFAULT_DRY_RUN value. Expected a boolean string.",
    );
  }
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
      options.env = parseEnvTarget(value);
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

  let resolvedEnv = options.env;
  try {
    resolvedEnv = resolvedEnv ?? readDefaultEnvTarget();
  } catch (error) {
    console.error((error as Error).message);
    process.exit(1);
    return;
  }

  let resolvedDryRun = options.dryRun;
  try {
    if (resolvedDryRun === undefined) {
      resolvedDryRun = readDefaultDryRun();
    }
  } catch (error) {
    console.error((error as Error).message);
    process.exit(1);
    return;
  }

  try {
    const result = await runUploadScript({
      env: resolvedEnv,
      files: options.files.length > 0 ? options.files : undefined,
      dryRun: resolvedDryRun,
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
      result.remoteOnly
        .slice(0, 5)
        .forEach((key) => console.warn(`   • ${key}`));
      if (result.remoteOnly.length > 5) {
        console.warn("   ...");
      }
    }
  } catch (error) {
    console.error((error as Error).message);
    process.exit(1);
  }
};

type PromoteCliOptions = PromoteScriptOptions;

const parsePromoteArgs = (args: string[]): PromoteCliOptions => {
  const options: PromoteCliOptions = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--source" || arg === "-s") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("Option '--source' expects a value.");
      }
      options.source = parseEnvTarget(value);
      index += 1;
      continue;
    }

    if (arg === "--target" || arg === "-t") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("Option '--target' expects a value.");
      }
      options.target = parseEnvTarget(value);
      index += 1;
      continue;
    }

    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (arg === "--overwrite") {
      options.overwrite = true;
      continue;
    }

    throw new Error(`Unknown option '${arg}'.`);
  }

  return options;
};

const runPromote = async (args: string[]) => {
  let options: PromoteCliOptions;
  try {
    options = parsePromoteArgs(args);
  } catch (error) {
    printUsage((error as Error).message);
    process.exit(1);
    return;
  }

  try {
    const result = await runPromoteScript(options);
    const copiedCount = result.copied.length;

    if (result.dryRun) {
      console.log(
        `Dry run: ${copiedCount} puzzle${copiedCount === 1 ? "" : "s"} would be copied from ${result.sourceBucket} to ${result.targetBucket}.`,
      );
      console.log("Manifest.json would be copied as well.");
      if (copiedCount === 0) {
        console.log("Nothing new to promote.");
      }
    } else if (copiedCount > 0) {
      console.log(
        `✅ Copied ${copiedCount} puzzle${copiedCount === 1 ? "" : "s"} from ${result.sourceBucket} to ${result.targetBucket}.`,
      );
      console.log("   Synced manifest.json.");
    } else {
      console.log(
        `No new puzzles to promote; manifest synced from ${result.sourceBucket}.`,
      );
    }

    if (!result.overwrite && result.skipped.length > 0) {
      console.warn(
        `Skipped ${result.skipped.length} puzzle${result.skipped.length === 1 ? "" : "s"} already present in ${result.targetBucket}. Use --overwrite to force copies.`,
      );
    }

    if (result.remoteOnly.length > 0) {
      console.warn(
        `Warning: ${result.targetBucket} contains ${result.remoteOnly.length} puzzle${result.remoteOnly.length === 1 ? "" : "s"} not present in ${result.sourceBucket}.`,
      );
      result.remoteOnly.slice(0, 5).forEach((key) => {
        console.warn(`   • ${key}`);
      });
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

  if (script === "promote") {
    await runPromote(args);
    return;
  }

  printUsage(`Unknown script: ${script}`);
  process.exit(1);
};

void main();
