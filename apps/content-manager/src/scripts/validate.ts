import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { validatePuzzle } from "../validation/index.js";
import type { ValidationIssue } from "../validation/types.js";

export interface ValidateScriptOptions {
  files?: string[];
}

export interface ValidateScriptIssue extends ValidationIssue {
  file: string;
}

export interface ValidateScriptResult {
  filesChecked: string[];
  issues: ValidateScriptIssue[];
}

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(MODULE_DIR, "..", "..");
const REPO_ROOT = path.resolve(WORKSPACE_ROOT, "..", "..");
const PUZZLES_DIR = path.resolve(WORKSPACE_ROOT, "src/puzzles");

const listPuzzleFiles = (directory: string): string[] =>
  fs
    .readdirSync(directory)
    .filter((entry) => entry.endsWith(".json"))
    .map((entry) => path.join(directory, entry))
    .sort();

const resolveExplicitFiles = (
  workspaceDir: string,
  puzzlesDir: string,
  files: string[],
): string[] =>
  files.map((input) => {
    if (path.isAbsolute(input)) {
      if (fs.existsSync(input)) {
        return input;
      }
      throw new Error(`File not found: ${input}`);
    }

    const fromRepo = path.resolve(REPO_ROOT, input);
    if (fs.existsSync(fromRepo)) {
      return fromRepo;
    }

    const fromWorkspace = path.resolve(workspaceDir, input);
    if (fs.existsSync(fromWorkspace)) {
      return fromWorkspace;
    }

    const fromPuzzles = path.resolve(puzzlesDir, input);
    if (fs.existsSync(fromPuzzles)) {
      return fromPuzzles;
    }

    throw new Error(`File not found: ${input}`);
  });

const deriveDateFromFileName = (filePath: string): string | undefined => {
  const name = path.basename(filePath, path.extname(filePath));
  const match = name.match(/\d{4}-\d{2}-\d{2}/u);
  return match?.[0];
};

const validateFile = (filePath: string): ValidationIssue[] => {
  const contents = fs.readFileSync(filePath, "utf8");

  try {
    const parsed = JSON.parse(contents) as unknown;
    return validatePuzzle(parsed, {
      expectedDate: deriveDateFromFileName(filePath),
    });
  } catch (error) {
    return [
      {
        field: "",
        message: `Invalid JSON: ${(error as Error).message}`,
      },
    ];
  }
};

export const runValidateScript = (
  options: ValidateScriptOptions = {},
): ValidateScriptResult => {
  const baseDir = WORKSPACE_ROOT;
  const puzzlesDirectory = PUZZLES_DIR;
  const filesToCheck =
    options.files && options.files.length > 0
      ? resolveExplicitFiles(baseDir, puzzlesDirectory, options.files)
      : listPuzzleFiles(puzzlesDirectory);

  if (filesToCheck.length === 0) {
    return { filesChecked: [], issues: [] };
  }

  const issues = filesToCheck.flatMap((file) =>
    validateFile(file).map((issue) => ({ file, ...issue })),
  );

  return {
    filesChecked: filesToCheck,
    issues,
  };
};
