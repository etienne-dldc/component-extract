import { Node, type VariableDeclaration } from "@ts-morph/ts-morph";

export function isVariableValidComponent(node: VariableDeclaration): boolean {
  // Get the initializer of the variable declaration
  const init = node.getInitializer();

  if (!init) return false;

  // Reject primitive literals
  if (
    Node.isStringLiteral(init) ||
    Node.isNumericLiteral(init) ||
    Node.isBigIntLiteral(init) ||
    Node.isNullLiteral(init)
  ) {
    return false;
  }

  // Check for boolean literals by text
  const initText = init.getText().toLowerCase();
  if (initText === "true" || initText === "false") {
    return false;
  }

  // Reject inline objects
  if (Node.isObjectLiteralExpression(init)) {
    return false;
  }

  // Reject inline arrays
  if (Node.isArrayLiteralExpression(init)) {
    return false;
  }

  // Accept everything else (function expressions, arrow functions, identifiers, etc.)
  return true;
}
