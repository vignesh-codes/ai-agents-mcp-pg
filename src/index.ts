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

// List resources handler - provides information about all available database tables
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
        description: `Schema information for the "${row.table_name}" table, including column names and data types. Use this to understand the table structure before querying or modifying it.`,
      })),
    };
  } catch (error) {
    throw error;
  } finally {
    client.release();
  }
});

// Read resource handler - retrieves detailed schema information for a specific table
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {

  const resourceUrl = new URL(request.params.uri);

  const pathComponents = resourceUrl.pathname.split("/");
  const schema = pathComponents.pop();
  const tableName = pathComponents.pop();


  if (schema !== SCHEMA_PATH) {
    throw new Error("Invalid resource URI - must end with '/schema' to retrieve table schema information");
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
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "query",
        description: "Run a read-only SQL query against the PostgreSQL database and return the results as JSON. Use this tool to retrieve data without modifying the database. Only SELECT statements and other non-modifying operations are allowed. Example: Query all users with age greater than 18.",
        inputSchema: {
          type: "object",
          properties: {
            sql: { 
              type: "string",
              description: "The SQL query to execute. Must be a SELECT statement or other read-only operation. Example: 'SELECT * FROM users WHERE age > 18'"
            },
          },
        },
      },
      {
        name: "create_table",
        description: "Create a new table in the PostgreSQL database with specified columns and data types. Use this tool to define new database tables with custom schemas. Example: Create a users table with id, name, email, and created_at columns.",
        inputSchema: {
          type: "object",
          properties: {
            tableName: { 
              type: "string",
              description: "Name for the new table. Should follow SQL naming conventions (letters, numbers, underscores). Example: 'users' or 'product_inventory'"
            },
            columns: {
              type: "array",
              description: "List of column definitions for the table, each with a name and PostgreSQL data type. Example: [{\"name\": \"id\", \"type\": \"SERIAL PRIMARY KEY\"}, {\"name\": \"name\", \"type\": \"VARCHAR(255)\"}, {\"name\": \"email\", \"type\": \"TEXT\"}, {\"name\": \"created_at\", \"type\": \"TIMESTAMP\"}]",
              items: {
                type: "object",
                properties: {
                  name: { 
                    type: "string",
                    description: "Column name. Should follow SQL naming conventions. Example: 'user_id' or 'email_address'"
                  },
                  type: { 
                    type: "string",
                    description: "PostgreSQL data type for this column. Examples: 'INTEGER', 'TEXT', 'VARCHAR(255)', 'TIMESTAMP', 'BOOLEAN', 'SERIAL PRIMARY KEY'"
                  },
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
        description: "Insert a new row/record into an existing table in the PostgreSQL database. Use this tool to add data to your tables. Example: Add a new user with name 'John Doe', email 'john@example.com', and age 30 to the users table.",
        inputSchema: {
          type: "object",
          properties: {
            tableName: { 
              type: "string",
              description: "Name of the existing table to insert data into. Example: 'users'"
            },
            values: {
              type: "object",
              description: "Key-value pairs where keys are column names and values are the data to insert. All values are passed as strings and converted to appropriate types by PostgreSQL. Example: {\"name\": \"John Doe\", \"email\": \"john@example.com\", \"age\": \"30\"}",
              additionalProperties: { 
                type: "string",
                description: "String representation of the value to insert. Will be converted to the appropriate type by PostgreSQL."
              },
            },
          },
          required: ["tableName", "values"],
        },
      },
      {
        name: "delete_table",
        description: "Permanently delete/drop an entire table from the PostgreSQL database, including all its data. Use with caution as this operation cannot be undone. Example: Delete a temporary_logs table that is no longer needed.",
        inputSchema: {
          type: "object",
          properties: {
            tableName: { 
              type: "string",
              description: "Name of the table to delete. This operation cannot be undone. Example: 'temporary_logs'"
            },
          },
          required: ["tableName"],
        },
      },
      {
        name: "update_entry",
        description: "Update existing rows in a PostgreSQL table that match specified conditions. Use this tool to modify data that already exists in the database. Example: Update the status to 'active' and last_login to current date for user with ID 42.",
        inputSchema: {
          type: "object",
          properties: {
            tableName: { 
              type: "string",
              description: "Name of the table containing records to update. Example: 'users'"
            },
            values: {
              type: "object",
              description: "Key-value pairs of columns to update and their new values. Example: {\"status\": \"active\", \"last_login\": \"2025-03-23\"}",
              additionalProperties: { 
                type: "string",
                description: "String representation of the new value. Will be converted to the appropriate type by PostgreSQL."
              },
            },
            conditions: {
              type: "object",
              description: "Key-value pairs that specify which rows to update (WHERE clause conditions). Only rows matching ALL conditions will be updated. Example: {\"user_id\": \"42\", \"status\": \"pending\"}",
              additionalProperties: { 
                type: "string",
                description: "String representation of the condition value. Will be compared using equality (=) operator."
              },
            },
          },
          required: ["tableName", "values", "conditions"],
        },
      },
      {
        name: "delete_entry",
        description: "Delete rows/records from a PostgreSQL table that match specified conditions. Use this tool to remove data from your database tables. Example: Delete all inactive users or users who haven't logged in since January 1, 2024.",
        inputSchema: {
          type: "object",
          properties: {
            tableName: { 
              type: "string",
              description: "Name of the table to delete records from. Example: 'users'"
            },
            conditions: {
              type: "object",
              description: "Key-value pairs that specify which rows to delete (WHERE clause conditions). Only rows matching ALL conditions will be deleted. Example: {\"status\": \"inactive\", \"last_login_before\": \"2024-01-01\"}",
              additionalProperties: { 
                type: "string",
                description: "String representation of the condition value. Will be compared using equality (=) operator."
              },
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
