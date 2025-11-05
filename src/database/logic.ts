import { db, schema } from "./database.ts";

const t = schema.tables;

export function saveFile(path: string) {
  const exist = db.exec(t.files.query().andFilterEqual({ path }).maybeOne());
  if (exist) {
    return exist;
  }

  // Read file content
  let content: string | null = null;
  try {
    content = Deno.readTextFileSync(path);
  } catch {
    // If file cannot be read, continue without content
  }

  const id = crypto.randomUUID();
  return db.exec(t.files.insert({ id, path, content }));
}
