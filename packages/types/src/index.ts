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
  /**
   * Array of word identifiers representing the order the puzzle should display by default.
   * Optional because some historical puzzles may lack the ordering metadata.
   */
  "starting order": string[];
}
