import type { CategoryDefinition, ConnectionsPuzzle } from "@econncore/types";
import type { ValidationContext, ValidationIssue } from "./types.js";

const ROOT_FIELDS = new Set(["date", "categories", "startGrid"]);

const CATEGORY_COLORS = new Set(["yellow", "green", "blue", "purple"]);
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/u;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const fieldPath = (...parts: (string | number)[]): string =>
  parts
    .map((part, index) => {
      if (typeof part === "number") {
        return `[${part}]`;
      }
      if (index === 0) {
        return part;
      }
      return `.${part}`;
    })
    .join("");

const validateRootKeys = (
  puzzle: Record<string, unknown>,
): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];

  for (const key of Object.keys(puzzle)) {
    if (!ROOT_FIELDS.has(key)) {
      issues.push({
        field: key,
        message: "Unexpected property.",
      });
    }
  }

  return issues;
};

const validateStartingOrder = (
  value: unknown,
  expectedWords: Set<string>,
): ValidationIssue[] => {
  const field = "startGrid";

  if (value === undefined) {
    return [
      {
        field,
        message: "Missing 'startGrid'. Expected an array of 16 words.",
      },
    ];
  }

  if (!Array.isArray(value)) {
    return [
      {
        field,
        message: "startGrid must be an array of strings.",
      },
    ];
  }

  const issues: ValidationIssue[] = [];
  const seen = new Set<string>();
  value.forEach((entry, index) => {
    if (typeof entry !== "string") {
      issues.push({
        field: fieldPath(field, index),
        message: "Entries in startGrid must be strings.",
      });
      return;
    }

    const trimmed = entry.trim();
    if (trimmed.length === 0) {
      issues.push({
        field: fieldPath(field, index),
        message: "startGrid entries cannot be empty.",
      });
      return;
    }

    if (trimmed !== entry) {
      issues.push({
        field: fieldPath(field, index),
        message:
          "startGrid entries should not have leading or trailing whitespace.",
      });
    }

    if (trimmed !== trimmed.toUpperCase()) {
      issues.push({
        field: fieldPath(field, index),
        message: `Word '${trimmed}' should be uppercase.`,
      });
    }

    if (seen.has(trimmed)) {
      issues.push({
        field: fieldPath(field, index),
        message: `Duplicate word '${trimmed}' in startGrid.`,
      });
    } else {
      seen.add(trimmed);
    }
  });

  if (expectedWords.size > 0) {
    if (seen.size !== expectedWords.size) {
      issues.push({
        field,
        message: `startGrid should list ${expectedWords.size} unique words; found ${seen.size}.`,
      });
    }

    const missing = [...expectedWords].filter((word) => !seen.has(word));
    if (missing.length > 0) {
      issues.push({
        field,
        message: `startGrid is missing words: ${missing.join(", ")}.`,
      });
    }
  }

  const extras = [...seen].filter(
    (word) => expectedWords.size > 0 && !expectedWords.has(word),
  );
  if (extras.length > 0) {
    issues.push({
      field,
      message: `startGrid includes words that are not in any category: ${extras.join(", ")}.`,
    });
  }

  return issues;
};

const validateCategoryWords = (
  value: unknown,
  categoryIndex: number,
  seenWords: Map<string, number>,
  globalWords: Set<string>,
): ValidationIssue[] => {
  if (!Array.isArray(value)) {
    return [
      {
        field: fieldPath("categories", categoryIndex, "words"),
        message: "Category words must be an array of strings.",
      },
    ];
  }

  if (value.length !== 4) {
    return [
      {
        field: fieldPath("categories", categoryIndex, "words"),
        message: `Each category must supply exactly 4 words (received ${value.length}).`,
      },
    ];
  }

  const issues: ValidationIssue[] = [];
  const localWords = new Set<string>();

  value.forEach((word, wordIndex) => {
    if (typeof word !== "string") {
      issues.push({
        field: fieldPath("categories", categoryIndex, "words", wordIndex),
        message: "Each word must be a string.",
      });
      return;
    }

    const trimmed = word.trim();
    if (trimmed.length === 0) {
      issues.push({
        field: fieldPath("categories", categoryIndex, "words", wordIndex),
        message: "Word cannot be empty.",
      });
      return;
    }

    if (trimmed !== word) {
      issues.push({
        field: fieldPath("categories", categoryIndex, "words", wordIndex),
        message: "Word should not contain leading or trailing whitespace.",
      });
    }

    if (trimmed !== trimmed.toUpperCase()) {
      issues.push({
        field: fieldPath("categories", categoryIndex, "words", wordIndex),
        message: `Word '${trimmed}' should be uppercase.`,
      });
    }

    if (localWords.has(trimmed)) {
      issues.push({
        field: fieldPath("categories", categoryIndex, "words", wordIndex),
        message: `Duplicate word '${trimmed}' within category.`,
      });
    } else {
      localWords.add(trimmed);
    }

    const existingCategoryIndex = seenWords.get(trimmed);
    if (
      existingCategoryIndex !== undefined &&
      existingCategoryIndex !== categoryIndex
    ) {
      issues.push({
        field: fieldPath("categories", categoryIndex, "words", wordIndex),
        message: `Word '${trimmed}' already assigned to category index ${existingCategoryIndex}.`,
      });
    } else {
      seenWords.set(trimmed, categoryIndex);
    }

    globalWords.add(trimmed);
  });

  return issues;
};

const validateCategoryColor = (
  value: unknown,
  index: number,
): ValidationIssue | undefined => {
  if (typeof value !== "string" || !CATEGORY_COLORS.has(value)) {
    return {
      field: fieldPath("categories", index, "color"),
      message: `Color must be one of ${Array.from(CATEGORY_COLORS).join(", ")}.`,
    };
  }

  return undefined;
};

const validateCategoryId = (
  value: unknown,
  index: number,
  seen: Set<string>,
): ValidationIssue | undefined => {
  if (!isNonEmptyString(value)) {
    return {
      field: fieldPath("categories", index, "id"),
      message: "Category id must be a non-empty string.",
    };
  }

  if (seen.has(value)) {
    return {
      field: fieldPath("categories", index, "id"),
      message: `Duplicate category id '${value}'.`,
    };
  }

  seen.add(value);
  return undefined;
};

const validateCategories = (
  value: unknown,
): { issues: ValidationIssue[]; words: Set<string> } => {
  const issues: ValidationIssue[] = [];
  const words = new Set<string>();

  if (!Array.isArray(value)) {
    issues.push({
      field: "categories",
      message: "Expected 'categories' to be an array of category definitions.",
    });
    return { issues, words };
  }

  if (value.length !== 4) {
    issues.push({
      field: "categories",
      message: `Expected exactly 4 categories, received ${value.length}.`,
    });
  }

  const seenIds = new Set<string>();
  const seenWords = new Map<string, number>();
  const colorCounts = new Map<string, number>();

  value.forEach((category, categoryIndex) => {
    if (!isRecord(category)) {
      issues.push({
        field: fieldPath("categories", categoryIndex),
        message: "Each category must be an object.",
      });
      return;
    }

    const current = category as Partial<CategoryDefinition> &
      Record<string, unknown>;

    const idIssue = validateCategoryId(current.id, categoryIndex, seenIds);
    if (idIssue) {
      issues.push(idIssue);
    }

    if (!isNonEmptyString(current.title)) {
      issues.push({
        field: fieldPath("categories", categoryIndex, "title"),
        message: "Category title must be a non-empty string.",
      });
    }

    const colorIssue = validateCategoryColor(current.color, categoryIndex);
    if (colorIssue) {
      issues.push(colorIssue);
    } else if (typeof current.color === "string") {
      colorCounts.set(current.color, (colorCounts.get(current.color) ?? 0) + 1);
    }

    const wordsIssues = validateCategoryWords(
      current.words,
      categoryIndex,
      seenWords,
      words,
    );
    issues.push(...wordsIssues);
  });

  if (words.size !== 16) {
    issues.push({
      field: "categories",
      message: `Categories should define 16 unique words; found ${words.size}.`,
    });
  }

  for (const color of CATEGORY_COLORS) {
    const count = colorCounts.get(color) ?? 0;

    if (count !== 1) {
      issues.push({
        field: "categories",
        message: `Expected exactly one '${color}' category; found ${count}.`,
      });
    }
  }

  return { issues, words };
};

const validateDate = (
  value: unknown,
  context: ValidationContext,
): ValidationIssue[] => {
  if (typeof value !== "string") {
    return [
      {
        field: "date",
        message: "Expected 'date' to be a string in YYYY-MM-DD format.",
      },
    ];
  }

  if (!DATE_REGEX.test(value)) {
    return [
      {
        field: "date",
        message: "Date must follow YYYY-MM-DD (e.g., 2024-01-01).",
      },
    ];
  }

  if (context.expectedDate && context.expectedDate !== value) {
    return [
      {
        field: "date",
        message: `Date (${value}) does not match filename (${context.expectedDate}).`,
      },
    ];
  }

  return [];
};

export const validatePuzzle = (
  rawPuzzle: unknown,
  context: ValidationContext,
): ValidationIssue[] => {
  if (!isRecord(rawPuzzle)) {
    return [
      {
        field: "",
        message: "Puzzle must be an object.",
      },
    ];
  }

  const issues: ValidationIssue[] = [];
  const puzzle = rawPuzzle as Partial<ConnectionsPuzzle> &
    Record<string, unknown>;

  issues.push(...validateDate(puzzle.date, context));
  const categoryResult = validateCategories(puzzle.categories);
  issues.push(...categoryResult.issues);
  issues.push(...validateStartingOrder(puzzle.startGrid, categoryResult.words));
  issues.push(...validateRootKeys(puzzle));

  return issues;
};
