import type { Identifier, Node, SourceFile } from "@ts-morph/ts-morph";
import type { RefKind } from "./database/database.ts";

export interface Location {
  file: SourceFile;
  node: Node;
  parent: Node | null; // null for top-level
}

export interface Declaration {
  identifier: Identifier;
  kind: RefKind | null;
  location: Location;
  isTopLevel: boolean;
}
