import type { Identifier, Node } from "@ts-morph/ts-morph";

/**
 * Check if a node is a call expression
 */
export function isCallExpression(node: Node): boolean {
  return node.getKindName() === "CallExpression";
}

/**
 * Extract the function identifier from a call expression
 */
export function extractCallIdentifier(node: Node): Identifier | null {
  const callExpr = node as unknown as { getExpression: () => Node };
  const expression = callExpr.getExpression?.();

  if (!expression) return null;

  // Simple identifier: foo()
  if (expression.getKindName() === "Identifier") {
    return expression as Identifier;
  }

  // Member expression: obj.method()
  if (expression.getKindName() === "PropertyAccessExpression") {
    const name = (expression as unknown as { getNameNode: () => Node })
      .getNameNode?.();
    if (name && name.getKindName() === "Identifier") {
      return name as Identifier;
    }
  }

  return null;
}
