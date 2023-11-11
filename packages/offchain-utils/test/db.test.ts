// // mocha tests for the new db.ts file

// import { expect } from "chai";
// import { createPool } from "../src/db";
// import { Knex } from "knex";

// // Define the type of rows in the "test" table
// interface TestRow {
//   id: number;
//   name: string;
//   foo: string;
// }

// async function cleanTestTable(pool: Knex<any, unknown[]>): Promise<void> {
//   await pool("test").delete();
// }

// describe("db", () => {
//   let pool: Knex<any, unknown[]>;

//   before(async () => {
//     pool = createPool();
//     await cleanTestTable(pool);
//   });

//   after(async () => {
//     await cleanTestTable(pool);
//     await pool.destroy();
//   });

//   it("basic connection should work", async () => {
//     const result = await pool.raw("SELECT 1+1 AS result");
//     expect(result.rows[0].result).equal(2);
//   });

//   it("should have zero records in the test table initially", async () => {
//     const result = await pool("test").select<Array<TestRow>>();
//     expect(result.length).to.equal(0);
//   });

//   it("should create a record in the test table using a random number and read it back", async () => {
//     const id = Math.floor(Math.random() * 1000000);
//     const name = "test" + id;
//     const foo = "foo" + id;

//     const writeResult = await pool("test")
//       .insert({ id, name, foo })
//       .returning("*");
//     expect(writeResult.length).to.equal(1);
//     expect(writeResult[0].id).to.equal(id);
//     expect(writeResult[0].name).to.equal(name);
//     expect(writeResult[0].foo).to.equal(foo);

//     const readResult = await pool("test")
//       .where({ id })
//       .select<Array<TestRow>>();
//     expect(readResult.length).to.equal(1);
//     expect(readResult[0].id).to.equal(id);
//     expect(readResult[0].name).to.equal(name);
//     expect(readResult[0].foo).to.equal(foo);
//   });
// });
