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

  return db.exec(t.files.insert({ path, content }));
}

export function saveRef() {
  return db.exec(
    t.refs.insert({}),
  );
}

export function saveDef(
  fileId: string,
  name: string,
  refId: string,
  parentRefId: string | null,
  startPos: number | null,
  endPos: number | null,
) {
  return db.exec(
    t.defs.insert({ fileId, name, refId, parentRefId, startPos, endPos }),
  );
}

export function saveUsage(
  fileId: string,
  refId: string,
  parentRefId: string | null,
  usedAs: string,
  startPos: number | null,
  endPos: number | null,
) {
  return db.exec(
    t.usages.insert({ fileId, refId, parentRefId, usedAs, startPos, endPos }),
  );
}
