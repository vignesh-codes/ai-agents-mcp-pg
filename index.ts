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

// Debug: Log the database URL

const resourceBaseUrl = new URL(databaseUrl);
resourceBaseUrl.protocol = "postgres:";
resourceBaseUrl.password = "";

const pool = new pg.Pool({
  connectionString: databaseUrl,
});

// Debug: Log the pool status

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

// List tools handler
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
    ],
  };
});

// Call tool handler
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

  throw new Error(`Unknown tool: ${request.params.name}`);
});

// Run the server
async function runServer() {

  // Insert the debug entry
  await insertDebugEntry();

  const transport = new StdioServerTransport();
  await server.connect(transport);

}

runServer().catch((error) => {
});
