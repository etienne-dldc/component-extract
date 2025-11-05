import { Expr } from "@dldc/zendb";
import type { ComponentDefinition } from "../references/definitions.ts";
import {
  computeNestedRefId,
  computeTopLevelRefId,
  referenceId,
} from "../references/referenceId.ts";
import type { RefKind } from "./database.ts";
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

export async function saveUsage(
  fileId: string,
  parentRefId: string | null,
  usageDefs: ComponentDefinition[],
  usedAs: string,
  startPos: number | null = null,
  endPos: number | null = null,
) {
  const refId = await saveDefs(usageDefs, "component");
  db.exec(
    t.usages.insert({
      id: crypto.randomUUID(),
      refId,
      parentRefId,
      fileId,
      usedAs,
      startPos,
      endPos,
    }),
  );
}

export async function saveDefs(
  defs: ComponentDefinition[],
  kind?: RefKind,
  parentRefId?: string | null,
  startPos: number | null = null,
  endPos: number | null = null,
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

  let refId: string;

  // For nested declarations, use a deterministic ref ID based on parent + name
  if (parentRefId && parentRefId !== null) {
    // Compute a consistent nested ref ID
    const defName = defsWithIds[0]?.name ?? "unknown";
    refId = await computeNestedRefId(parentRefId, defName);
  } else {
    // For top-level, use existing refId if one exists, otherwise compute deterministic one
    if (existingRefsIds.size === 1) {
      // Reuse the single existing ref ID
      refId = Array.from(existingRefsIds)[0];
    } else if (existingRefsIds.size > 1) {
      // Multiple existing refs - merge them
      refId = mergeRefs(Array.from(existingRefsIds));
    } else {
      // No existing defs - compute deterministic ref ID from first def's name
      const defName = defsWithIds[0]?.name ?? "unknown";
      refId = await computeTopLevelRefId(defName);
    }
  }

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

  // Insert new defs (deduplicate by def.id first)
  const defsToInsert = new Map<string, typeof defsWithIds[0]>();
  for (const def of defsWithIds) {
    const isExisting = existing.find((e) => e.id === def.id);
    if (!isExisting && !defsToInsert.has(def.id)) {
      defsToInsert.set(def.id, def);
    }
  }

  for (const def of defsToInsert.values()) {
    // Double-check that this def doesn't already exist before insertion
    const checkExists = db.exec(
      t.defs.query().andFilterEqual({ id: def.id }).maybeOne(),
    );
    if (!checkExists) {
      db.exec(
        t.defs.insert({
          id: def.id,
          fileId: def.file.id,
          name: def.name,
          refId,
          parentRefId: parentRefId ?? null,
          startPos,
          endPos,
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
