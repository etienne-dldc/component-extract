import { type Identifier, Node, type SourceFile } from "@ts-morph/ts-morph";
import type { RefKind } from "./database/database.ts";
import { getElementType } from "./getElementType.ts";
import { isComponentName } from "./isComponentName.ts";
import { isVariableValidComponent } from "./isVariableValidComponent.ts";

export interface TopLevelElement {
  node: Node;
  identifier: Identifier;
  kind: RefKind | null;
}

/**
 * Find all top-level function/variable declarations
 * This includes functions, constants, and potential components
 */
export function findTopLevelElements(file: SourceFile): TopLevelElement[] {
  const elements: TopLevelElement[] = [];

  // Get all top-level declarations
  file.forEachChild((node) => {
    // Check function declarations
    if (Node.isFunctionDeclaration(node)) {
      const funcNode = node;
      const name = funcNode.getName();
      if (name) {
        const identifier = funcNode.getNameNode();
        if (identifier && Node.isIdentifier(identifier)) {
          const kind = getElementType(funcNode);
          elements.push({ node: funcNode, identifier, kind });
        }
      }
    } // Check variable declarations
    else if (Node.isVariableStatement(node)) {
      const varNode = node;
      const declarations = varNode.getDeclarations();
      declarations.forEach((decl) => {
        const name = decl.getName();
        if (name) {
          const nameNode = decl.getNameNode();
          if (nameNode && Node.isIdentifier(nameNode)) {
            const kind = getElementType(decl);
            // Include if it's a valid component OR if it has a potential type
            if (isComponentName(name) && isVariableValidComponent(decl)) {
              elements.push({ node: decl, identifier: nameNode, kind });
            } else if (kind !== null) {
              // Include functions and constants even if not component-named
              elements.push({ node: decl, identifier: nameNode, kind });
            }
          }
        }
      });
    }
  });

  return elements;
}
