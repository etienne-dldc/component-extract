import { Database } from "@db/sqlite";
import {
  Column,
  Migration,
  Schema,
  type TOperation,
  type TOperationResult,
} from "@dldc/zendb";
import { DbSqliteDriver } from "@dldc/zendb-db-sqlite";

/**
 * TODO: add more kinds as needed
 */
export type RefKind = "function" | "component" | "constant";

const baseSchema = Schema.declare({
  files: {
    id: Column.text().primary(),
    path: Column.text(),
    content: Column.text().nullable(),
  },
  refs: {
    id: Column.text().primary(),
    kind: Column.json<RefKind[]>().defaultValue(() => []),
  },
  defs: {
    id: Column.text().primary(),
    fileId: Column.text(),
    name: Column.text(),
    refId: Column.text(),
    parentRefId: Column.text().nullable(),
    startPos: Column.integer().nullable(),
    endPos: Column.integer().nullable(),
  },
  usages: {
    id: Column.text().primary(),
    fileId: Column.text(),
    refId: Column.text(),
    parentRefId: Column.text().nullable(),
    usedAs: Column.text(),
    startPos: Column.integer().nullable(),
    endPos: Column.integer().nullable(),
  },
});

const migration = Migration.init(DbSqliteDriver, baseSchema, () => {});

export const schema = migration.schema;

const [dbFile] = await migration.apply(
  await DbSqliteDriver.createDatabase(),
);

export const db = {
  exec<Op extends TOperation>(op: Op): TOperationResult<Op> {
    return DbSqliteDriver.exec(dbFile, op);
  },
  execMany<Op extends TOperation>(ops: Op[]): TOperationResult<Op>[] {
    return DbSqliteDriver.execMany(dbFile, ops);
  },
  save(path: string) {
    const diskDb = new Database(path);
    dbFile.backup(diskDb);
    dbFile.close();
    diskDb.close();
  },
};
