import { Project } from "@ts-morph/ts-morph";
import { db } from "./src/database/database.ts";
import { saveDefs, saveFile, saveUsage } from "./src/database/logic.ts";
import { findComponentDefinitions } from "./src/findComponentDefinitions.ts";
import { findComponents } from "./src/findComponents.ts";
import { findJsxUsagesByComponent } from "./src/findJsxUsagesByComponent.ts";
import { containsJsx } from "./src/getElementType.ts";

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

    // First, find all elements (functions, constants, components) in the file
    const elements = findComponents(file);

    // Then, find all JSX elements in the file and determine which element they belong to
    const jsxUsagesByElement = findJsxUsagesByComponent(file, elements);

    // Log results for each element
    for (const element of elements) {
      // Determine final kind: if it's a function that contains JSX or was used as JSX, it's a component
      let finalKind = element.kind;
      if (element.kind === "function" && containsJsx(element.node)) {
        finalKind = "component";
      }

      console.log(
        `Found ${finalKind || "unknown"}:`,
        element.identifier.getText(),
      );
      const compDefs = findComponentDefinitions(element.identifier);
      const parentRefId = await saveDefs(compDefs, finalKind ?? undefined);

      const usedElements = jsxUsagesByElement.get(element.node) || [];
      if (usedElements.length > 0) {
        for (const usedElement of usedElements) {
          const usageDefs = findComponentDefinitions(usedElement.identifier);
          // JSX usages are always components
          await saveUsage(
            dbFile.id,
            parentRefId,
            usageDefs,
            usedElement.usedAs,
          );
        }
      }
    }

    // Log JSX usages at file level (not inside any element)
    const fileLevelJsxUsages = jsxUsagesByElement.get(null) || [];
    if (fileLevelJsxUsages.length > 0) {
      for (const usedElement of fileLevelJsxUsages) {
        const usageDefs = findComponentDefinitions(usedElement.identifier);
        // JSX usages are always components
        await saveUsage(dbFile.id, null, usageDefs, usedElement.usedAs);
      }
    }
  }

  db.save(databasePath);
}
