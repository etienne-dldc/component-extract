import { extract } from "./mod.ts";

// await extract({
//   tsConfigFilePath:
//     "/Users/etienne/Workspace/local/etienne-dldc/comp-museum-playground/tsconfig.app.json",
//   databasePath: "/Users/etienne/Downloads/dev/museum/playground.db",
// });

await extract({
  tsConfigFilePath:
    "/Users/etienne/Workspace/github.com/etienne-dldc/money/tsconfig.app.json",
  databasePath: "/Users/etienne/Downloads/dev/museum/money.db",
});
