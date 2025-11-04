import type { Identifier } from "@ts-morph/ts-morph";

export interface ComponentDefinition {
  file: string;
  name: string;
}

/**
 * Find all top level function/variables that could be a component definition
 */
export function findComponentDefinitions(
  componentIdentifier: Identifier,
): ComponentDefinition[] {
  const definitions = componentIdentifier.getDefinitions();
  if (definitions.length === 0) {
    throw new Error(
      `No definition found for component: ${componentIdentifier.getText()}`,
    );
  }
  return (definitions.map((def) => {
    const file = def.getSourceFile().getFilePath();
    const name = def.getName();
    return { file, name };
  }));
}
