#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import pg from "pg";

// Initialize the server
const server = new Server(
  {
    name: "example-servers/postgres",
    version: "0.1.0",
  },
  {
    capabilities: {
      resources: {},
      tools: {},
    },
  },
);

const args = process.argv.slice(2);

// Check if the database URL is passed
if (args.length === 0) {
  process.exit(1);
}

const databaseUrl = args[0];

const resourceBaseUrl = new URL(databaseUrl);
resourceBaseUrl.protocol = "postgres:";
resourceBaseUrl.password = "";

const pool = new pg.Pool({
  connectionString: databaseUrl,
});


const SCHEMA_PATH = "schema";

// Debug Insert for testing purposes
async function insertDebugEntry() {
  const client = await pool.connect();
  try {

    // Example insert query into `example_table`
    const result = await client.query(
      "INSERT INTO users (name, email, age) VALUES ($1, $2, $3) RETURNING id",
      ["sample1", "sample1@gmail.com", 30],
    );

  } catch (error) {
  } finally {
    client.release();
  }
}

// List resources handler
server.setRequestHandler(ListResourcesRequestSchema, async () => {

  const client = await pool.connect();
  try {

    const result = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
    );


    return {
      resources: result.rows.map((row) => ({
        uri: new URL(`${row.table_name}/${SCHEMA_PATH}`, resourceBaseUrl).href,
        mimeType: "application/json",
        name: `"${row.table_name}" database schema`,
      })),
    };
  } catch (error) {
    throw error;
  } finally {
    client.release();
  }
});

// Read resource handler
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {

  const resourceUrl = new URL(request.params.uri);

  const pathComponents = resourceUrl.pathname.split("/");
  const schema = pathComponents.pop();
  const tableName = pathComponents.pop();


  if (schema !== SCHEMA_PATH) {
    throw new Error("Invalid resource URI");
  }

  const client = await pool.connect();
  try {

    const result = await client.query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1",
      [tableName],
    );


    return {
      contents: [
        {
          uri: request.params.uri,
          mimeType: "application/json",
          text: JSON.stringify(result.rows, null, 2),
        },
      ],
    };
  } catch (error) {
    throw error;
  } finally {
    client.release();
  }
});

// This handler returns the list of tools that the server supports
/*
Has the following properties:
- name: The name of the tool
- description: A short description of the tool's purpose
- inputSchema: The JSON schema for the input parameters of the tool

for query, create_table, insert_entry, delete_table, update_entry, delete_entry
*/
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "query",
        description: "Run a read-only SQL query",
        inputSchema: {
          type: "object",
          properties: {
            sql: { type: "string" },
          },
        },
      },
      {
        name: "create_table",
        description: "Create a new table in the database",
        inputSchema: {
          type: "object",
          properties: {
            tableName: { type: "string" },
            columns: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  type: { type: "string" },
                },
                required: ["name", "type"],
              },
            },
          },
          required: ["tableName", "columns"],
        },
      },
      {
        name: "insert_entry",
        description: "Insert a new entry into a table",
        inputSchema: {
          type: "object",
          properties: {
            tableName: { type: "string" },
            values: {
              type: "object",
              additionalProperties: { type: "string" },
            },
          },
          required: ["tableName", "values"],
        },
      },
      {
        name: "delete_table",
        description: "Delete a table from the database",
        inputSchema: {
          type: "object",
          properties: {
            tableName: { type: "string" },
          },
          required: ["tableName"],
        },
      },
      {
        name: "update_entry",
        description: "Update an entry in a table",
        inputSchema: {
          type: "object",
          properties: {
            tableName: { type: "string" },
            values: {
              type: "object",
              additionalProperties: { type: "string" },
            },
            conditions: {
              type: "object",
              additionalProperties: { type: "string" },
            },
          },
          required: ["tableName", "values", "conditions"],
        },
      },
      {
        name: "delete_entry",
        description: "Delete an entry from a table",
        inputSchema: {
          type: "object",
          properties: {
            tableName: { type: "string" },
            conditions: {
              type: "object",
              additionalProperties: { type: "string" },
            },
          },
          required: ["tableName", "conditions"],
        },
      },
    ],
  };
});

// Call tool handler for SQL operations
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "query") {
    const sql = request.params.arguments?.sql as string;

    const client = await pool.connect();
    try {
      await client.query("BEGIN TRANSACTION READ ONLY");
      const result = await client.query(sql);

      return {
        content: [{ type: "text", text: JSON.stringify(result.rows, null, 2) }],
        isError: false,
      };
    } catch (error) {
      throw error;
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  }

  if (request.params.name === "create_table") {
    const { tableName, columns } = request.params.arguments as {
      tableName: string;
      columns: { name: string; type: string }[];
    };

    const columnDefinitions = columns
      .map((col) => `${col.name} ${col.type}`)
      .join(", ");

    const client = await pool.connect();
    try {
      const createTableQuery = `CREATE TABLE ${tableName} (${columnDefinitions})`;
      await client.query(createTableQuery);

      return {
        content: [
          {
            type: "text",
            text: `Table "${tableName}" created successfully with columns: ${columns
              .map((col) => `${col.name} (${col.type})`)
              .join(", ")}`,
          },
        ],
        isError: false,
      };
    } catch (error) {
      throw error;
    } finally {
      client.release();
    }
  }

  if (request.params.name === "insert_entry") {
    const { tableName, values } = request.params.arguments as {
      tableName: string;
      values: Record<string, string>;
    };

    const columns = Object.keys(values).join(", ");
    const placeholders = Object.keys(values)
      .map((_, index) => `$${index + 1}`)
      .join(", ");
    const valuesArray = Object.values(values);

    const client = await pool.connect();
    try {
      const insertQuery = `INSERT INTO ${tableName} (${columns}) VALUES (${placeholders}) RETURNING *`;
      const result = await client.query(insertQuery, valuesArray);

      return {
        content: [
          {
            type: "text",
            text: `Inserted into table "${tableName}": ${JSON.stringify(
              result.rows[0],
              null,
              2
            )}`,
          },
        ],
        isError: false,
      };
    } catch (error) {
      throw error;
    } finally {
      client.release();
    }
  }

  if (request.params.name === "delete_table") {
    const { tableName } = request.params.arguments as {
      tableName: string;
    };

    const client = await pool.connect();
    try {
      const deleteTableQuery = `DROP TABLE IF EXISTS ${tableName}`;
      await client.query(deleteTableQuery);
      return {
        content: [
          {
            type: "text",
            text: `Table "${tableName}" deleted successfully`,
          },
        ],
        isError: false,
      };
    } catch (error) {
      throw error;
    } finally {
      client.release();
    }
  }

  if (request.params.name === "update_entry") {
    const { tableName, values, conditions } = request.params.arguments as {
      tableName: string;
      values: Record<string, string>;
      conditions: Record<string, string>;
    };

    const setClauses = Object.entries(values)
      .map(([key, _], index) => `${key} = $${index + 1}`)
      .join(", ");
    const whereClauses = Object.entries(conditions)
      .map(([key, _], index) => `${key} = $${Object.keys(values).length + index + 1}`)
      .join(" AND ");
    const queryParams = [...Object.values(values), ...Object.values(conditions)];

    const client = await pool.connect();
    try {
      const updateQuery = `UPDATE ${tableName} SET ${setClauses} WHERE ${whereClauses} RETURNING *`;
      const result = await client.query(updateQuery, queryParams);

      return {
        content: [
          {
            type: "text",
            text: `Updated entry in table "${tableName}": ${JSON.stringify(result.rows, null, 2)}`,
          },
        ],
        isError: false,
      };
    } catch (error) {
      throw error;
    } finally {
      client.release();
    }
  }

  if (request.params.name === "delete_entry") {
    const { tableName, conditions } = request.params.arguments as {
      tableName: string;
      conditions: Record<string, string>;
    };

    const whereClauses = Object.entries(conditions)
      .map(([key, _], index) => `${key} = $${index + 1}`)
      .join(" AND ");
    const queryParams = Object.values(conditions);

    const client = await pool.connect();
    try {
      const deleteQuery = `DELETE FROM ${tableName} WHERE ${whereClauses} RETURNING *`;
      const result = await client.query(deleteQuery, queryParams);

      return {
        content: [
          {
            type: "text",
            text: `Deleted entry from table "${tableName}": ${JSON.stringify(result.rows, null, 2)}`,
          },
        ],
        isError: false,
      };
    } catch (error) {
      throw error;
    } finally {
      client.release();
    }
  }

  throw new Error(`Unknown tool: ${request.params.name}`);
});

// Run the server
async function runServer() {

  // Insert the debug entry for testing
  // await insertDebugEntry();

  const transport = new StdioServerTransport();
  await server.connect(transport);

}

runServer().catch((error) => {
});
