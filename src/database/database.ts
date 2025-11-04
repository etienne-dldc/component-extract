import { Database } from "@db/sqlite";
import {
  Column,
  Migration,
  Schema,
  type TOperation,
  type TOperationResult,
} from "@dldc/zendb";
import { DbSqliteDriver } from "@dldc/zendb-db-sqlite";

export type RefKind = "function" | "component" | "constant";

const baseSchema = Schema.declare({
  files: {
    id: Column.text().primary(),
    path: Column.text(),
  },
  refs: {
    id: Column.text().primary(),
    kind: Column.text<RefKind>().nullable(),
  },
  defs: {
    id: Column.text().primary(),
    fileId: Column.text(),
    name: Column.text(),
    refId: Column.text(),
  },
  usages: {
    id: Column.text().primary(),
    fileId: Column.text(),
    refId: Column.text(),
    parentRefId: Column.text().nullable(),
    usedAs: Column.text(),
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
