import { Node, type Symbol, SyntaxKind } from "@ts-morph/ts-morph";
import {
  handleIdentifierDefinition,
  handleIdentifierUsage,
} from "./handleIdentifier.ts";

const SKIP_KINDS = new Set([
  SyntaxKind.StringLiteral,
  SyntaxKind.EndOfFileToken,
  // Skip type def for now
  SyntaxKind.InterfaceDeclaration,
  SyntaxKind.TypeReference,

  SyntaxKind.JsxText,
  SyntaxKind.JsxClosingElement,
  SyntaxKind.EqualsGreaterThanToken,
]);

const PASS_THROUGH_KINDS = new Set([
  SyntaxKind.ExpressionStatement,
  SyntaxKind.CallExpression,
  SyntaxKind.PropertyAccessExpression,
  SyntaxKind.NonNullExpression,
  SyntaxKind.JsxSelfClosingElement,
  SyntaxKind.JsxAttributes,
  SyntaxKind.ImportDeclaration,
  SyntaxKind.ImportClause,
  SyntaxKind.NamedImports,
  SyntaxKind.ImportSpecifier,
  SyntaxKind.NamespaceImport,
  SyntaxKind.FirstStatement,
  SyntaxKind.ExportKeyword,
  SyntaxKind.VariableDeclarationList,
  SyntaxKind.FunctionExpression,
  SyntaxKind.Block,
  SyntaxKind.ReturnStatement,
  SyntaxKind.ParenthesizedExpression,
  SyntaxKind.JsxElement,
  SyntaxKind.JsxOpeningElement,
  SyntaxKind.ArrowFunction,
  SyntaxKind.ExportDeclaration,
  SyntaxKind.NamedExports,
]);

const STOP_KIND: SyntaxKind | null = null;

const COLLECTED_UNHANDLED_KINDS = new Set<SyntaxKind>();

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
      `Stopped traversal at node kind: SyntaxKind.${SyntaxKind[STOP_KIND!]}\n` +
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
    if (Node.isIdentifier(name)) {
      const nexParentRefId = handleIdentifierDefinition(
        typeIdsMap,
        fileId,
        parentRefId,
        name,
      );
      if (initializer) {
        traverseNode(typeIdsMap, fileId, nexParentRefId, initializer);
      }
      return;
    }
    // For destructuring and other patterns, just traverse children
    if (initializer) {
      traverseNode(typeIdsMap, fileId, parentRefId, initializer);
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
    node.forEachChild((child) =>
      traverseNode(typeIdsMap, fileId, nextParentRefId, child)
    );
    return;
  }

  if (Node.isIdentifier(node)) {
    handleIdentifierUsage(typeIdsMap, fileId, parentRefId, node);
    return;
  }

  COLLECTED_UNHANDLED_KINDS.add(node.getKind());
  if (COLLECTED_UNHANDLED_KINDS.size >= 10) {
    const names = Array.from(COLLECTED_UNHANDLED_KINDS).map((kind) => {
      return `SyntaxKind.${SyntaxKind[kind]},`;
    }).join("\n  ");

    console.error(
      names,
    );

    throw new Error(
      `Unhandled node kinds`,
    );
  }

  node.forEachChild((child) =>
    traverseNode(typeIdsMap, fileId, parentRefId, child)
  );
}
