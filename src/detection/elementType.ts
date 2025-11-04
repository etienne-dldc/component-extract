import { Node, type VariableDeclaration } from "@ts-morph/ts-morph";
import type { RefKind } from "../database/database.ts";

/**
 * Determine if a variable declaration is a constant (primitive or plain object/array)
 */
export function isConstant(node: VariableDeclaration): boolean {
  const init = node.getInitializer();

  if (!init) return false;

  // Accept primitive literals
  if (
    Node.isStringLiteral(init) ||
    Node.isNumericLiteral(init) ||
    Node.isBigIntLiteral(init) ||
    Node.isNullLiteral(init)
  ) {
    return true;
  }

  // Check for boolean literals by text
  const initText = init.getText().toLowerCase();
  if (initText === "true" || initText === "false") {
    return true;
  }

  // Accept inline objects and arrays (plain data structures)
  if (
    Node.isObjectLiteralExpression(init) ||
    Node.isArrayLiteralExpression(init)
  ) {
    return true;
  }

  return false;
}

/**
 * Determine the type of a function or variable
 */
export function getElementType(node: Node): RefKind | null {
  // Check if it's a function declaration or arrow function
  if (Node.isFunctionDeclaration(node)) {
    return "function";
  }

  if (Node.isVariableDeclaration(node)) {
    const init = node.getInitializer();
    if (!init) return null;

    // Arrow functions and function expressions
    if (
      Node.isArrowFunction(init) ||
      Node.isFunctionExpression(init)
    ) {
      return "function";
    }

    // Constants (primitives, plain objects, arrays)
    if (isConstant(node)) {
      return "constant";
    }

    // Other values could be functions or components
    // We'll determine component status when we find JSX usage
    return null;
  }

  return null;
}

/**
 * Check if a node contains JSX (either directly or in its children)
 */
export function containsJsx(node: Node): boolean {
  let hasJsx = false;

  function traverse(n: Node): void {
    if (Node.isJsxElement(n) || Node.isJsxSelfClosingElement(n)) {
      hasJsx = true;
      return;
    }
    n.forEachChild(traverse);
  }

  traverse(node);
  return hasJsx;
}

/**
 * Check if a variable is a valid component or should be tracked
 */
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
