import { Node, type SourceFile } from "@ts-morph/ts-morph";
import { isComponentName } from "./detection/componentName.ts";
import {
  getElementType,
  isVariableValidComponent,
} from "./detection/elementType.ts";
import {
  extractCallIdentifier,
  isCallExpression,
} from "./detection/functionCall.ts";
import {
  extractIdentifierFromJsx,
  getJsxTagNode,
  isValidJsxUsage,
} from "./detection/jsx.ts";
import { computeNestedRefId } from "./references/referenceId.ts";
import type { Declaration } from "./types.ts";

/**
 * Callback to store a declaration as it's found
 */
export type OnDeclaration = (
  decl: Declaration,
  parentRefId: string | null,
) => Promise<void>;

/**
 * Callback to store a usage (JSX or function call) as it's found
 */
export type OnUsage = (
  identifier: string,
  parentRefId: string | null,
  kind: "jsx" | "call",
) => Promise<void>;

/**
 * Unified traversal that finds both declarations and usages in a single AST walk
 * Stores elements as they are found via callbacks instead of returning a result
 */
export async function traverse(
  file: SourceFile,
  onDeclaration: OnDeclaration,
  onUsage: OnUsage,
): Promise<void> {
  const pendingCallbacks: Promise<void>[] = [];
  const refIdPromises = new Map<string, Promise<string>>();

  /**
   * Get or compute a ref ID for a declaration (either returns it or schedules computation)
   */
  async function getRefId(
    parentRefId: string | null,
    refName: string,
  ): Promise<string> {
    if (!parentRefId) {
      // Top-level ref - still hash it for consistency
      const encoder = new TextEncoder();
      const data = encoder.encode(refName);
      const digest = await crypto.subtle.digest("SHA-256", data);
      return new Uint8Array(digest).toHex();
    }

    // Create a unique key for this combination
    const key = `${parentRefId}#${refName}`;
    if (refIdPromises.has(key)) {
      return await refIdPromises.get(key)!;
    }

    // Compute the nested ref ID
    const promise = computeNestedRefId(parentRefId, refName);
    refIdPromises.set(key, promise);
    return await promise;
  }

  /**
   * Recursively traverse the AST
   */
  async function traverseNode(
    node: Node,
    parent: Node | null,
    parentRefId: string | null,
  ): Promise<void> {
    // Find declarations
    if (Node.isFunctionDeclaration(node)) {
      const name = node.getName();
      if (name) {
        const identifier = node.getNameNode();
        if (identifier && Node.isIdentifier(identifier)) {
          const kind = getElementType(node);
          const decl: Declaration = {
            identifier,
            kind,
            location: { file, node, parent },
            isTopLevel: parent === null,
          };
          pendingCallbacks.push(onDeclaration(decl, parentRefId));

          // Compute nested ref ID for this declaration
          const refId = await getRefId(parentRefId, name);

          // Continue traversing with this node as parent and this refId as the parent ref
          for (const child of node.getChildren()) {
            await traverseNode(child, node, refId);
          }
          return;
        }
      }
      // Continue traversing with this node as parent
      for (const child of node.getChildren()) {
        await traverseNode(child, node, parentRefId);
      }
      return;
    }

    if (Node.isVariableDeclaration(node)) {
      const name = node.getName();
      if (name) {
        const nameNode = node.getNameNode();
        if (nameNode && Node.isIdentifier(nameNode)) {
          const kind = getElementType(node);
          // Include if it's a valid component OR if it has a potential type
          if (isComponentName(name) && isVariableValidComponent(node)) {
            const decl: Declaration = {
              identifier: nameNode,
              kind,
              location: { file, node, parent },
              isTopLevel: parent === null,
            };
            pendingCallbacks.push(onDeclaration(decl, parentRefId));

            // Compute nested ref ID for this declaration
            const refId = await getRefId(parentRefId, name);
            for (const child of node.getChildren()) {
              await traverseNode(child, node, refId);
            }
            return;
          } else if (kind !== null) {
            // Include functions and constants even if not component-named
            const decl: Declaration = {
              identifier: nameNode,
              kind,
              location: { file, node, parent },
              isTopLevel: parent === null,
            };
            pendingCallbacks.push(onDeclaration(decl, parentRefId));

            // Compute nested ref ID for this declaration
            const refId = await getRefId(parentRefId, name);
            for (const child of node.getChildren()) {
              await traverseNode(child, node, refId);
            }
            return;
          }
        }
      }
    }

    // Find JSX usages
    const jsxTag = getJsxTagNode(node);
    if (jsxTag && isValidJsxUsage(jsxTag)) {
      const identifier = extractIdentifierFromJsx(jsxTag);
      if (identifier) {
        pendingCallbacks.push(
          onUsage(identifier.getText(), parentRefId, "jsx"),
        );
      }
    }

    // Find function call usages
    if (isCallExpression(node)) {
      const identifier = extractCallIdentifier(node);
      if (identifier) {
        pendingCallbacks.push(
          onUsage(identifier.getText(), parentRefId, "call"),
        );
      }
    }

    // Continue traversing children
    for (const child of node.getChildren()) {
      await traverseNode(child, parent, parentRefId);
    }
  }

  // Start traversal from file level
  for (const child of file.getChildren()) {
    await traverseNode(child, null, null);
  }

  // Wait for all callbacks to complete
  await Promise.all(pendingCallbacks);
}
