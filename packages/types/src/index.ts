export type CategoryColor = "yellow" | "green" | "blue" | "purple";

export interface CategoryDefinition {
  id: string;
  title: string;
  words: string[];
  color: CategoryColor;
}

export interface ConnectionsPuzzle {
  date: string;
  categories: CategoryDefinition[];
  startGrid: string[];
}
