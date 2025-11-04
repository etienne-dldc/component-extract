import { Expr } from "@dldc/zendb";
import type { ComponentDefinition } from "../findComponentDefinitions.ts";
import { referenceId } from "../referenceId.ts";
import type { RefKind } from "./database.ts";
import { db, schema } from "./database.ts";

const t = schema.tables;

export function saveFile(path: string) {
  const exist = db.exec(t.files.query().andFilterEqual({ path }).maybeOne());
  if (exist) {
    return exist;
  }
  const id = crypto.randomUUID();
  return db.exec(t.files.insert({ id, path }));
}

export async function saveUsage(
  fileId: string,
  parentRefId: string | null,
  usageDefs: ComponentDefinition[],
  usedAs: string,
) {
  const refId = await saveDefs(usageDefs, "component");
  db.exec(
    t.usages.insert({
      id: crypto.randomUUID(),
      refId,
      parentRefId,
      fileId,
      usedAs,
    }),
  );
}

export async function saveDefs(
  defs: ComponentDefinition[],
  kind?: RefKind,
): Promise<string> {
  const defsWithIds = await Promise.all(
    defs.map(async (def) => {
      // ensure file
      const file = saveFile(def.file);
      return ({
        ...def,
        id: await referenceId(def.file, def.name),
        file,
      });
    }),
  );

  const existing = db.exec(
    t.defs.query().andWhere((c) =>
      Expr.inList(c.id, defsWithIds.map((r) => Expr.external(r.id)))
    ).all(),
  );

  const existingRefsIds = new Set(existing.map((ref) => ref.refId));

  const refId = existingRefsIds.size > 1
    ? mergeRefs(Array.from(existingRefsIds))
    : crypto.randomUUID();

  // Ensure or update the ref with the kind
  const existingRef = db.exec(
    t.refs.query().andFilterEqual({ id: refId }).maybeOne(),
  );
  if (existingRef) {
    // Update the ref with kind if provided.
    // Never downgrade an existing component ref to a function.
    if (kind) {
      if (!existingRef.kind) {
        // No kind yet => set it
        db.exec(
          t.refs.updateEqual({ kind }, { id: refId }),
        );
      } else if (existingRef.kind === kind) {
        // same kind => nothing to do
      } else if (existingRef.kind === "component" && kind === "function") {
        // don't transform a component into a function => skip
      } else {
        // other changes allowed (e.g. function -> component)
        db.exec(
          t.refs.updateEqual({ kind }, { id: refId }),
        );
      }
    }
  } else {
    // Create new ref with kind
    db.exec(t.refs.insert({ id: refId, kind: kind ?? null }));
  }

  // Insert new defs
  for (const def of defsWithIds) {
    const isExisting = existing.find((e) => e.id === def.id);
    if (!isExisting) {
      db.exec(
        t.defs.insert({
          id: def.id,
          fileId: def.file.id,
          name: def.name,
          refId,
        }),
      );
    }
  }

  return refId;
}

function mergeRefs(
  refIds: string[],
): string {
  if (refIds.length === 0) {
    throw new Error("No refIds to merge");
  }
  if (refIds.length === 1) {
    return refIds[0];
  }
  const newRefId = crypto.randomUUID();
  db.exec(
    t.defs.update(
      { refId: newRefId },
      (c) => Expr.inList(c.id, refIds.map((id) => Expr.external(id))),
    ),
  );
  db.exec(
    t.usages.update(
      { refId: newRefId },
      (c) => Expr.inList(c.refId, refIds.map((id) => Expr.external(id))),
    ),
  );

  return newRefId;
}
