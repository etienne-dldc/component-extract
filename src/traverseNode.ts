import { Node, type Symbol, SyntaxKind } from "@ts-morph/ts-morph";
import {
  handleIdentifierDefinition,
  handleIdentifierUsage,
} from "./handleIdentifier.ts";
import { PASS_THROUGH_KINDS, SKIP_KINDS, STOP_KIND } from "./tokens.ts";

const COLLECTED_UNHANDLED_KINDS: Node[] = [];

/**
 * Handle known node kinds.
 * handle identifiers and traverse children otherwise
 */
export function traverseNode(
  typeIdsMap: Map<Symbol, string>,
  fileId: string,
  parentRefId: string | null,
  node: Node,
): void {
  if (node.getKind() === STOP_KIND) {
    throw new Error(
      `Stopped traversal at node kind: SyntaxKind.${node.getKindName()}\n` +
        `in ${node.getSourceFile().getFilePath()}:${node.getStartLineNumber()}`,
    );
  }

  if (SKIP_KINDS.has(node.getKind())) {
    return;
  }

  if (PASS_THROUGH_KINDS.has(node.getKind())) {
    node.forEachChild((child) =>
      traverseNode(typeIdsMap, fileId, parentRefId, child)
    );
    return;
  }

  if (Node.isVariableDeclaration(node)) {
    const name = node.getNameNode();
    const initializer = node.getInitializer();
    let nextParentRefId = parentRefId;
    if (Node.isIdentifier(name)) {
      nextParentRefId = handleIdentifierDefinition(
        typeIdsMap,
        fileId,
        parentRefId,
        name,
      );
    }
    // For destructuring and other patterns, just traverse children
    if (initializer) {
      traverseChildren(typeIdsMap, fileId, nextParentRefId, initializer);
    }
    return;
  }

  if (Node.isFunctionDeclaration(node)) {
    const name = node.getNameNode();
    let nextParentRefId = parentRefId;
    if (name) {
      nextParentRefId = handleIdentifierDefinition(
        typeIdsMap,
        fileId,
        parentRefId,
        name,
      );
    }
    traverseChildren(typeIdsMap, fileId, nextParentRefId, node, name);
    return;
  }

  if (Node.isIdentifier(node)) {
    handleIdentifierUsage(typeIdsMap, fileId, parentRefId, node);
    return;
  }

  COLLECTED_UNHANDLED_KINDS.push(node);
  if (COLLECTED_UNHANDLED_KINDS.length >= 1) {
    COLLECTED_UNHANDLED_KINDS.forEach((n) => {
      const columnOffset = n.getPos() - n.getStartLinePos() + 1;
      console.error(
        `Unhandled node kind: SyntaxKind.${SyntaxKind[n.getKind()]}\n` +
          `  in ${n.getSourceFile().getFilePath()}:${n.getStartLineNumber()}:${columnOffset}`,
      );
    });
    throw new Error(
      `Multiple unhandled node kinds collected.`,
    );
  }

  traverseChildren(typeIdsMap, fileId, parentRefId, node);
}

/**
 * @param typeIdsMap
 * @param fileId
 * @param parentRefId
 * @param node
 * @param nameNode Optional node to skip (e.g. the name of a declaration)
 */
export function traverseChildren(
  typeIdsMap: Map<Symbol, string>,
  fileId: string,
  parentRefId: string | null,
  node: Node,
  nameNode?: Node,
) {
  node.forEachChild((child) => {
    if (nameNode && child === nameNode) {
      return;
    }
    traverseNode(typeIdsMap, fileId, parentRefId, child);
  });
}
