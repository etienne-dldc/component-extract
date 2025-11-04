import {
  type Identifier,
  type JsxTagNameExpression,
  Node,
  type SourceFile,
} from "@ts-morph/ts-morph";
import type { Element } from "./findComponents.ts";
import { isComponentName } from "./isComponentName.ts";

export interface UsedElement {
  identifier: Identifier;
  usedAs: string;
}

export function findJsxUsagesByComponent(
  file: SourceFile,
  elements: Element[],
): Map<Node | null, UsedElement[]> {
  const resultMap = new Map<Node | null, UsedElement[]>();

  // Initialize entries for each element and one for file-level
  for (const element of elements) {
    resultMap.set(element.node, []);
  }
  resultMap.set(null, []);

  // Find all JSX elements and determine which element they belong to
  function traverse(node: Node, currentElement: Element | null): void {
    if (!node) return;

    function handleJsxTagNameExpression(tagNameNode: JsxTagNameExpression) {
      const tagName = tagNameNode.getText();
      if (tagName && isComponentName(tagName)) {
        const key = currentElement ? currentElement.node : null;
        const usages = resultMap.get(key) || [];
        const identifierNode = getIdentifierNode(tagNameNode);
        usages.push({ identifier: identifierNode, usedAs: tagName });
        resultMap.set(key, usages);
      }
    }

    // Check if this is a JSX element
    if (Node.isJsxElement(node)) {
      const tagNameNode = node.getOpeningElement().getTagNameNode();
      handleJsxTagNameExpression(tagNameNode);
    } // Check if this is a JSX self-closing element
    else if (Node.isJsxSelfClosingElement(node)) {
      const tagNameNode = node.getTagNameNode();
      handleJsxTagNameExpression(tagNameNode);
    }

    // Check if we're entering an element definition
    let nextElement = currentElement;
    if (Node.isFunctionDeclaration(node)) {
      const foundElement = elements.find((e) => e.node === node);
      if (foundElement) {
        nextElement = foundElement;
      }
    } else if (Node.isVariableDeclaration(node)) {
      const foundElement = elements.find((e) => e.node === node);
      if (foundElement) {
        nextElement = foundElement;
      }
    }

    // Recursively traverse children
    node.forEachChild((child) => traverse(child, nextElement));
  }

  file.forEachChild((node) => traverse(node, null));

  // Remove empty entries
  for (const [key, usages] of resultMap) {
    if (usages.length === 0) {
      resultMap.delete(key);
    }
  }

  return resultMap;
}

function getIdentifierNode(node: Node): Identifier {
  // For member expressions like Ariakit.Role.label, get the rightmost identifier
  if (Node.isPropertyAccessExpression(node)) {
    const name = node.getNameNode();
    if (Node.isIdentifier(name)) {
      return name;
    }
  }
  // For simple identifiers, return as-is
  if (Node.isIdentifier(node)) {
    return node;
  }
  throw new Error("Unable to extract identifier from node: " + node.getText());
}
