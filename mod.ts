import { Project, type Symbol } from "@ts-morph/ts-morph";
import { db } from "./src/database/database.ts";
import { saveFile } from "./src/database/logic.ts";
import { traverseNode } from "./src/traverseNode.ts";

export interface TConfig {
  tsConfigFilePath: string;
  databasePath: string;
}

export function extract({ tsConfigFilePath, databasePath }: TConfig) {
  const project = new Project({ tsConfigFilePath });

  const typeIdsMap = new Map<Symbol, string>();

  const files = project.getSourceFiles();

  console.log(`Found ${files.length} files to analyze.`);

  for (const file of files) {
    if (file.isDeclarationFile()) {
      continue;
    }

    const dbFile = saveFile(file.getFilePath());
    console.log(`Analyzing file: ${dbFile.path}`);

    file.forEachChild((node) =>
      traverseNode(typeIdsMap, dbFile.id, null, node)
    );
  }

  db.save(databasePath);
}
