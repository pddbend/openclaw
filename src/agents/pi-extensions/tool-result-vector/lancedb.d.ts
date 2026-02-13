/**
 * Type declarations for @lancedb/lancedb (optional dependency).
 * LanceDB is loaded dynamically, these types are for compile-time checking.
 */

declare module "@lancedb/lancedb" {
  interface Table {
    add(rows: unknown[]): Promise<void>;
    vectorSearch(vector: number[]): { limit(n: number): { toArray(): Promise<unknown[]> } };
    query(): { where(condition: string): { toArray(): Promise<unknown[]> } };
    delete(condition: string): Promise<void>;
    countRows(): Promise<number>;
  }

  interface Connection {
    tableNames(): Promise<string[]>;
    openTable(name: string): Promise<Table>;
    createTable(name: string, data: unknown[]): Promise<Table>;
  }

  export function connect(path: string): Promise<Connection>;
}
