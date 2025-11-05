import { Project, type ts } from "@ts-morph/ts-morph";
import { db } from "./src/database/database.ts";
import { saveFile } from "./src/database/logic.ts";

export interface TConfig {
  tsConfigFilePath: string;
  databasePath: string;
}

export async function extract({ tsConfigFilePath, databasePath }: TConfig) {
  const project = new Project({ tsConfigFilePath });

  const typeIdsMap = new Map<ts.Symbol, string>();

  const files = project.getSourceFiles();

  console.log(`Found ${files.length} files to analyze.`);

  for (const file of files) {
    const dbFile = saveFile(file.getFilePath());
    console.log(`Analyzing file: ${dbFile.path}`);

    // TODO
  }

  db.save(databasePath);
}
