# Copilot Instructions for component-extract

## Project Overview

**component-extract** is a Deno-based static analysis tool that parses TypeScript/React projects to extract and catalog component definitions, function calls, and other element usages. It builds an SQLite database mapping declarations to usages with parent-child relationships.

### Core Purpose
- Extract TypeScript/React project structure into a queryable database
- Track component definitions (functions, constants, JSX components)
- Record usage relationships (JSX elements, function calls, nested scopes)
- Enable code graph analysis and dependency visualization

## Architecture

### Single-Pass Unified Analysis (Recent Refactoring)
The codebase uses a **single AST walk** (not three separate passes). This is critical:

- **Entry**: `src/analyze/index.ts` exposes `analyze(file)` function
- **Core**: `src/analyze/traverser.ts` performs unified traversal collecting both declarations and usages in one pass
- **Result**: Returns `AnalysisResult { declarations: Declaration[], usages: Usage[] }`
- **Key Benefit**: Performance (3x faster than previous three-pass approach)

### Module Structure

```
src/
├── analyze/          # Single unified AST traversal engine
├── detection/        # Modular node type detectors
├── references/       # Reference resolution (definitions, ID generation)
├── database/         # SQLite schema & persistence layer
├── types.ts          # Unified type system (Declaration, Usage, Location, AnalysisResult)
```

### Data Model

**Location**: Tracks parent-child relationships for scoping
```typescript
interface Location {
  file: SourceFile;
  node: Node;
  parent: Node | null;  // null for top-level
}
```

**Declaration**: Any function, constant, or variable declaration
```typescript
interface Declaration {
  identifier: Identifier;
  kind: RefKind | null;  // "function" | "component" | "constant"
  location: Location;
  isTopLevel: boolean;
}
```

**Usage**: Any JSX element, function call, or reference
```typescript
interface Usage {
  identifier: Identifier;
  usedAs: string;
  kind: "jsx" | "call" | "reference";
  location: Location;
}
```

### Detection Patterns

**Component Identification** (`detection/componentName.ts`):
- Component names must start with uppercase letter (React convention: `/^[A-Z]/`)

**Element Type Detection** (`detection/elementType.ts`):
- **Function**: Function declarations or arrow/expression functions
- **Component**: Functions containing JSX or used as JSX
- **Constant**: Primitive literals, plain objects/arrays (no function expressions)

**JSX Detection** (`detection/jsx.ts`):
- Finds JSX elements and self-closing elements
- Extracts component identifiers (handles member expressions like `Ariakit.Role`)
- Only tracks component-named JSX usage

**Function Call Detection** (`detection/functionCall.ts`):
- Tracks all `CallExpression` nodes
- Handles simple identifiers and member expressions

### Database Schema

**Tables**:
- `files`: Source file metadata (id, path)
- `refs`: Reference objects (id, kind: RefKind | null)
- `defs`: Definitions linking files to refs (id, fileId, name, refId)
- `usages`: Usage records with parent scope (id, fileId, refId, parentRefId, usedAs)

**Key Pattern**: `parentRefId` tracks the containing function/scope for nested usages

## Main Workflow

**mod.ts** - Entry point orchestrates:
1. Load TypeScript project via ts-morph
2. Filter `.tsx` files
3. For each file:
   - Call `analyze(file)` → single AST pass returns declarations + usages
   - Iterate declarations, determining final kind (function → component if has JSX)
   - Save declarations to database via `saveDefs()`
   - Collect usages belonging to each declaration (filtered by `location.parent`)
   - Save usages via `saveUsage()` with parent reference
4. Persist database to disk

**Key Implementation Detail**: Usages are filtered by `usage.location.parent === decl.location.node` to associate them with their containing scope.

## Development Patterns

### Adding New Detection Types
1. Create detector function in `src/detection/`
2. Call from `src/analyze/traverser.ts::traverseNode()`
3. Push results to `declarations[]` or `usages[]` array
4. Update types in `src/types.ts` if needed

### Modifying Database Schema
1. Edit `src/database/database.ts` (schema declaration)
2. Migration auto-runs on next load
3. Update `src/database/logic.ts` save functions if adding new fields

### Debugging Analysis Results
Use `temp.ts` for experimentation:
```typescript
import { Project } from "@ts-morph/ts-morph";
import { analyze } from "./src/analyze/index.ts";

const project = new Project({ tsConfigFilePath: "./tsconfig.json" });
const file = project.getSourceFile("example.tsx")!;
const result = analyze(file);
console.log("Declarations:", result.declarations.length);
console.log("Usages:", result.usages.length);
```

## Dependencies & Runtime

- **Runtime**: Deno (no Node.js)
- **TypeScript Parsing**: @ts-morph/ts-morph (AST manipulation)
- **Database**: @db/sqlite + @dldc/zendb (schema-based SQLite ORM)
- **Database Driver**: @dldc/zendb-db-sqlite
- **Task**: Run `deno task run:temp` to execute temp.ts

## Common Tasks

- **Analyze a project**: `new Project({tsConfigFilePath}).getSourceFiles().filter(f => f.endsWith(".tsx"))`
- **Get file definitions**: `findComponentDefinitions(identifier)` from `src/references/definitions.ts`
- **Generate stable IDs**: `referenceId(filePath, exportName)` - SHA256 hash for deduplication across locations

## Important Notes

- **No visitor pattern**: Uses direct node type checking (`Node.isFunctionDeclaration()`, etc) in traversal
- **Parent tracking**: Essential for scoping - always pass `parent` when recursing
- **Single walk assumption**: Performance depends on unified traversal - don't split analysis into multiple passes
- **TypeScript projects only**: Requires valid `tsconfig.json` for ts-morph initialization
- **React-specific**: Assumes component naming conventions and JSX usage patterns
