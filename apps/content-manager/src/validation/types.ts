export type ValidationIssue = {
  field: string;
  message: string;
};

export type ValidationContext = {
  expectedDate?: string;
};
