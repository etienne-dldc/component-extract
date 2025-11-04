import type {
  Identifier,
  JsxTagNameExpression,
  Node,
} from "@ts-morph/ts-morph";
import { isComponentName } from "./componentName.ts";

/**
 * Check if a node is a JSX element or self-closing element
 * Returns the tag name node if it's JSX, null otherwise
 */
export function getJsxTagNode(node: Node): JsxTagNameExpression | null {
  if (node.getKindName() === "JsxElement") {
    const jsxElement = node as unknown as {
      getOpeningElement: () => { getTagNameNode: () => JsxTagNameExpression };
    };
    const openingElement = jsxElement.getOpeningElement?.();
    if (openingElement) {
      return openingElement.getTagNameNode();
    }
  } else if (node.getKindName() === "JsxSelfClosingElement") {
    const jsxElement = node as unknown as {
      getTagNameNode: () => JsxTagNameExpression;
    };
    return jsxElement.getTagNameNode?.();
  }
  return null;
}

/**
 * Extract identifier from a JSX tag name expression
 */
export function extractIdentifierFromJsx(node: Node): Identifier | null {
  // For member expressions like Ariakit.Role.label, get the rightmost identifier
  if (node.getKindName() === "PropertyAccessExpression") {
    const propAccess = node as unknown as { getNameNode: () => Node };
    const name = propAccess.getNameNode?.();
    if (name && name.getKindName() === "Identifier") {
      return name as Identifier;
    }
  }
  // For simple identifiers, return as-is
  if (node.getKindName() === "Identifier") {
    return node as Identifier;
  }
  return null;
}

/**
 * Check if a JSX element should be tracked (component-named)
 */
export function isValidJsxUsage(tagNode: JsxTagNameExpression): boolean {
  const tagName = tagNode.getText();
  return isComponentName(tagName);
}
