import type { Identifier, Symbol } from "@ts-morph/ts-morph";
import { saveDef, saveRef, saveUsage } from "./database/logic.ts";

const WARNING_ENABLED = false;

export function handleIdentifierUsage(
  typeIdsMap: Map<Symbol, string>,
  fileId: string,
  parentRefId: string | null,
  node: Identifier,
): void {
  const refId = getRefId(typeIdsMap, node);
  saveUsage(
    fileId,
    refId,
    parentRefId,
    node.getText(),
    node.getStart(),
    node.getEnd(),
  );
}

export function handleIdentifierDefinition(
  typeIdsMap: Map<Symbol, string>,
  fileId: string,
  parentRefId: string | null,
  node: Identifier,
): string {
  const refId = getRefId(typeIdsMap, node);
  saveDef(
    fileId,
    node.getText(),
    refId,
    parentRefId,
    node.getStart(),
    node.getEnd(),
  );
  return refId;
}

function getRefId(
  typeIdsMap: Map<Symbol, string>,
  node: Identifier,
): string {
  const typeSymbol = getTypeSymbol(node);

  if (!typeSymbol) {
    return crypto.randomUUID();
  }
  let typeId = typeIdsMap.get(typeSymbol);
  if (!typeId) {
    const ref = saveRef();
    typeId = ref.id;
    typeIdsMap.set(typeSymbol, typeId);
  }
  return typeId;
}

function getTypeSymbol(node: Identifier): Symbol | null {
  const typeSymbol = node.getType().getAliasSymbol() ??
    node.getType().getSymbol();

  if (typeSymbol) {
    return typeSymbol;
  }

  // Try to find declaration instead
  const defs = node.getDefinitionNodes();
  const symbolsFromDefs = Array.from(
    new Set(
      defs
        .map((def) =>
          def.getType().getAliasSymbol() ??
            def.getType().getSymbol()
        )
        .filter((s): s is Symbol => s !== undefined),
    ),
  );
  if (symbolsFromDefs.length === 1) {
    return symbolsFromDefs[0];
  }
  const columnOffset = node.getPos() - node.getStartLinePos() + 1;
  if (symbolsFromDefs.length > 1) {
    if (WARNING_ENABLED) {
      console.warn(
        `  Identifier has multiple symbols from definitions: ${node.getText()}\n` +
          `    in ${node.getSourceFile().getFilePath()}:${node.getStartLineNumber()}:${columnOffset}`,
      );
    }
    return null;
  }

  if (WARNING_ENABLED) {
    console.warn(
      `  Identifier has no symbol: ${node.getText()}\n` +
        `    in ${node.getSourceFile().getFilePath()}:${node.getStartLineNumber()}:${columnOffset}`,
    );
  }

  return null;
}
