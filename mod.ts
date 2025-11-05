import { Project } from "@ts-morph/ts-morph";
import { db } from "./src/database/database.ts";
import { saveDefs, saveFile, saveUsage } from "./src/database/logic.ts";
import { containsJsx } from "./src/detection/elementType.ts";
import { findComponentDefinitions } from "./src/references/definitions.ts";
import { traverse } from "./src/traverser.ts";
import type { Declaration } from "./src/types.ts";

export interface TConfig {
  tsConfigFilePath: string;
  databasePath: string;
}

export async function extract({ tsConfigFilePath, databasePath }: TConfig) {
  const project = new Project({ tsConfigFilePath });

  const tsxFiles = project.getSourceFiles().filter((file) =>
    file.getFilePath().endsWith(".tsx")
  );

  console.log(`Found ${tsxFiles.length} TSX files to analyze.`);

  for (const file of tsxFiles) {
    const dbFile = saveFile(file.getFilePath());
    console.log(`Analyzing file: ${dbFile.path}`);

    // Callbacks for traverse
    const onDeclaration = async (
      decl: Declaration,
      parentRefId: string | null,
    ) => {
      // Determine final kind: if it's a function that contains JSX, it's a component
      let finalKind = decl.kind;
      if (decl.kind === "function" && containsJsx(decl.location.node)) {
        finalKind = "component";
      }

      console.log(
        `Found ${finalKind || "unknown"}:`,
        decl.identifier.getText(),
      );

      const compDefs = findComponentDefinitions(decl.identifier);
      await saveDefs(
        compDefs,
        finalKind ?? undefined,
        parentRefId,
        decl.location.startPos,
        decl.location.endPos,
      );
    };

    const onUsage = async (
      identifierText: string,
      parentRefId: string | null,
      _kind: "jsx" | "call",
      startPos: number,
      endPos: number,
    ) => {
      // Find component definitions for this usage
      // We need to create a minimal definition object
      const usageName = identifierText;
      const usageDefs = [{ file: file.getFilePath(), name: usageName }];

      // For JSX usages, always mark as component; for calls, use the detected type
      await saveUsage(
        dbFile.id,
        parentRefId,
        usageDefs,
        identifierText,
        startPos,
        endPos,
      );
    };

    // Execute the unified traversal with callbacks
    await traverse(file, onDeclaration, onUsage);
  }

  db.save(databasePath);
}
