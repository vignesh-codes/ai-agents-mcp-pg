# PostgreSQL MCP Server

A Model Context Protocol server that provides access to PostgreSQL databases. This server enables LLMs to interact with databases to inspect schemas, execute queries, and perform CRUD (Create, Read, Update, Delete) operations on database entries. This repo is an extension of [PostgreSQL MCP Server](https://github.com/modelcontextprotocol/servers/tree/main/src/postgres) providing functionalities to create tables, insert entries, update entries, delete entries, and drop tables.

# Installation
To install the PostgreSQL MCP Server, follow these steps:

1. Install Docker and Claude Desktop
2. Clone the repository: `git clone https://github.com/vignesh-codes/ai-agents-mcp-pg.git`
3. Run PG Docker container `docker run --name postgres-container -e POSTGRES_USER=admin -e POSTGRES_PASSWORD=admin_password -e POSTGRES_DB=mydatabase -p 5432:5432 -d postgres:latest`
4. Build the mcp server: `docker build -t mcp/postgres -f src/Dockerfile .`
5. Open Claude Desktop and connect to the MCP server by updating the `mcpServers` field in `claude_desktop_config.json`: 

## Usage with Claude Desktop

To use this server with the Claude Desktop app, add the following configuration to the "mcpServers" section of your `claude_desktop_config.json`:

### Docker

* When running Docker on macOS, use `host.docker.internal` if the server is running on the host network (e.g., localhost).
* Username/password can be added to the PostgreSQL URL with `postgresql://user:password@host:port/db-name`.

```json
{
  "mcpServers": {
    "postgres": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "mcp/postgres",
        "postgresql://username:password@host.docker.internal:5432/mydatabase"
      ]
    }
  }
}
```

Make sure to restart the claude desktop app after updating the config file.

## Features Added

### Existing Functionality

- **query**
  - Execute read-only SQL queries against the connected database.
  - **Input:** `sql` (string): The SQL query to execute.
  - All queries are executed within a READ-ONLY transaction.

### New Functionality

1. **Create Tables**
   - Ability to create new tables dynamically by providing a table name and column definitions.
   - **Input from Claude Desktop:**
     ```json
     {
       "tableName": "example_table",
       "columns": [
         { "name": "id", "type": "SERIAL PRIMARY KEY" },
         { "name": "name", "type": "VARCHAR(255)" },
         { "name": "age", "type": "INTEGER" }
       ]
     }
     ```

2. **Insert Entries**
   - Insert new entries into a specified table.
   - **Input from Claude Desktop:**
     ```json
     {
       "tableName": "example_table",
       "values": {
         "name": "John Doe",
         "age": 30
       }
     }
     ```

3. **Update Entries**
   - Update existing entries in a table based on conditions.
   - **Input from Claude Desktop:**
     ```json
     {
       "tableName": "example_table",
       "values": {
         "age": 35
       },
       "conditions": "name = 'John Doe'"
     }
     ```

4. **Delete Entries**
   - Delete specific entries in a table based on conditions.
   - **Input from Claude Desktop:**
     ```json
     {
       "tableName": "example_table",
       "conditions": "name = 'John Doe'"
     }
     ```

5. **Drop Tables**
   - Drop existing tables from the database.
   - **Input from Claude Desktop:**
     ```json
     {
       "tableName": "example_table"
     }
     ```

### Resources

The server provides schema information for each table in the database:

- **Table Schemas** (`postgres://<host>/<table>/schema`)
  - JSON schema information for each table.
  - Includes column names and data types.
  - Automatically discovered from database metadata.

## Sample 

### Input to Claude Desktop

```
lets create three tables - users, payments and orders tables. Each table must have a unique id and other required columns. Payments table must have user id as foreign key. Orders table must have payment id as foreign key. Add some sample data to these tables
```

### Output from Claude Desktop

```
I'll help you create these three interconnected tables and populate them with sample data. Let's create them one by one.



1. First, let's create the users table:
{
  `columns`: [
    {
      `name`: `id`,
      `type`: `INTEGER PRIMARY KEY`
    },
    {
      `name`: `name`,
      `type`: `TEXT`
    },
    {
      `name`: `email`,
      `type`: `TEXT`
    },
    {
      `name`: `created_at`,
      `type`: `TEXT`
    }
  ],
  `tableName`: `users`
}

2. Now, let's create the payments table with a foreign key reference to users:
{
  `columns`: [
    {
      `name`: `id`,
      `type`: `INTEGER PRIMARY KEY`
    },
    {
      `name`: `user_id`,
      `type`: `INTEGER`
    },
    {
      `name`: `amount`,
      `type`: `REAL`
    },
    {
      `name`: `status`,
      `type`: `TEXT`
    },
    {
      `name`: `payment_date`,
      `type`: `TEXT`
    }
  ],
  `tableName`: `payments`
}

3. Finally, let's create the orders table with a foreign key reference to payments:
{
  `columns`: [
    {
      `name`: `id`,
      `type`: `INTEGER PRIMARY KEY`
    },
    {
      `name`: `payment_id`,
      `type`: `INTEGER`
    },
    {
      `name`: `product_name`,
      `type`: `TEXT`
    },
    {
      `name`: `quantity`,
      `type`: `INTEGER`
    },
    {
      `name`: `order_date`,
      `type`: `TEXT`
    }
  ],
  `tableName`: `orders`
}

Now, let's add some sample data to these tables.

First, let's add some users:
{
  `values`: {
    `id`: `1`,
    `name`: `John Doe`,
    `email`: `john@example.com`,
    `created_at`: `2024-01-01`
  },
  `tableName`: `users`
}

{
  `values`: {
    `id`: `2`,
    `name`: `Jane Smith`,
    `email`: `jane@example.com`,
    `created_at`: `2024-01-05`
  },
  `tableName`: `users`
}

Now, let's add some payments for these users:
{
  `values`: {
    `id`: `1`,
    `amount`: `99.99`,
    `status`: `completed`,
    `user_id`: `1`,
    `payment_date`: `2024-01-10`
  },
  `tableName`: `payments`
}

{
  `values`: {
    `id`: `2`,
    `amount`: `149.99`,
    `status`: `completed`,
    `user_id`: `2`,
    `payment_date`: `2024-01-12`
  },
  `tableName`: `payments`
}


Finally, let's add some orders linked to these payments:
{
  `values`: {
    `id`: `1`,
    `quantity`: `1`,
    `order_date`: `2024-01-10`,
    `payment_id`: `1`,
    `product_name`: `Laptop`
  },
  `tableName`: `orders`
}

{
  `values`: {
    `id`: `2`,
    `quantity`: `2`,
    `order_date`: `2024-01-12`,
    `payment_id`: `2`,
    `product_name`: `Smartphone`
  },
  `tableName`: `orders`
}

Let's verify the data by querying each table:

{
  `sql`: `SELECT * FROM users;`
}

{
  `sql`: `SELECT * FROM payments;`
}

{
  `sql`: `SELECT * FROM orders;`
}

Great! We have now created three interconnected tables with sample data. Here's a summary of what we've set up:

1. Users table with basic user information
2. Payments table linked to users through user_id
3. Orders table linked to payments through payment_id

The data shows two users who have each made one payment and placed one order. We can now perform various queries to analyze the relationships between these tables. Would you like to see any specific queries or add more data?

```

### Input to Claude Desktop
```
add few more users with IN_PROGRESS and UNSUCCESSFUL payment status
```

### Output from Claude Desktop
```
I'll add a few more users with different payment statuses.

First, let's add new users:

{
  `values`: {
    `id`: `3`,
    `name`: `Mike Johnson`,
    `email`: `mike@example.com`,
    `created_at`: `2024-01-08`
  },
  `tableName`: `users`
}

{
  `values`: {
    `id`: `4`,
    `name`: `Sarah Wilson`,
    `email`: `sarah@example.com`,
    `created_at`: `2024-01-09`
  },
  `tableName`: `users`
}

{
  `values`: {
    `id`: `5`,
    `name`: `Tom Brown`,
    `email`: `tom@example.com`,
    `created_at`: `2024-01-11`
  },
  `tableName`: `users`
}

Now, let's add payments with IN_PROGRESS and UNSUCCESSFUL statuses for these users:
{
  `values`: {
    `id`: `3`,
    `amount`: `299.99`,
    `status`: `IN_PROGRESS`,
    `user_id`: `3`,
    `payment_date`: `2024-01-13`
  },
  `tableName`: `payments`
}

{
  `values`: {
    `id`: `4`,
    `amount`: `199.99`,
    `status`: `UNSUCCESSFUL`,
    `user_id`: `4`,
    `payment_date`: `2024-01-13`
  },
  `tableName`: `payments`
}

{
  `values`: {
    `id`: `4`,
    `amount`: `199.99`,
    `status`: `UNSUCCESSFUL`,
    `user_id`: `4`,
    `payment_date`: `2024-01-13`
  },
  `tableName`: `payments`
}


{
  `values`: {
    `id`: `5`,
    `amount`: `399.99`,
    `status`: `IN_PROGRESS`,
    `user_id`: `5`,
    `payment_date`: `2024-01-13`
  },
  `tableName`: `payments`
}

Let's add orders for the IN_PROGRESS payments (note that we won't add orders for the UNSUCCESSFUL payment):
{
  `values`: {
    `id`: `3`,
    `quantity`: `1`,
    `order_date`: `2024-01-13`,
    `payment_id`: `3`,
    `product_name`: `Gaming Console`
  },
  `tableName`: `orders`
}

{
  `values`: {
    `id`: `4`,
    `quantity`: `1`,
    `order_date`: `2024-01-13`,
    `payment_id`: `5`,
    `product_name`: `4K TV`
  },
  `tableName`: `orders`
}

Let's verify the data by checking all payments with their status:

{
  `sql`: `SELECT u.name, p.amount, p.status, p.payment_date 
FROM users u 
JOIN payments p ON u.id = p.user_id 
ORDER BY p.payment_date;`
}

Now we have a good mix of payment statuses in our database:
- 2 completed payments (John and Jane)
- 2 in-progress payments (Mike and Tom)
- 1 unsuccessful payment (Sarah)

The orders table only contains entries for completed and in-progress payments, as it makes sense not to create orders for unsuccessful payments. Would you like to see any specific queries or add more data?
```


### Input to Claude Desktop
```
Fetch the users info who have IN_PROGRESS payment status
```

### Output from Claude Desktop
```
I'll write a query to fetch user information for those who have payments with IN_PROGRESS status.
{
  `sql`: `
SELECT u.*, p.amount, p.payment_date
FROM users u
JOIN payments p ON u.id = p.user_id
WHERE p.status = 'IN_PROGRESS'
ORDER BY u.id;
`
}

We can see that two users have payments in progress:
1. Mike Johnson (attempting to pay $299.99)
2. Tom Brown (attempting to pay $399.99)

Both payments were initiated on January 13, 2024. Would you like to see any additional information about these users or their orders?

```

### Input to Claude Desktop
```
Lets update the payment status to completed for Mike Johnson
```

### Output from Claude Desktop
```

I'll update Mike Johnson's payment status from IN_PROGRESS to completed.
{
  `values`: {
    `status`: `completed`
  },
  `tableName`: `payments`,
  `conditions`: {
    `user_id`: `3`
  }
}


Let's verify the update by checking all payments again:

{
  `sql`: `
SELECT u.name, p.amount, p.status, p.payment_date 
FROM users u 
JOIN payments p ON u.id = p.user_id 
ORDER BY p.status, p.payment_date;
`
}

The update was successful. Now we have:
- 3 completed payments (John, Jane, and Mike)
- 1 in-progress payment (Tom)
- 1 unsuccessful payment (Sarah)

Would you like to make any other updates to the data?

```

## DB ENTRIES

```
mydatabase=# SELECT * FROM users;
 id |     name     |       email       | created_at 
----+--------------+-------------------+------------
  1 | John Doe     | john@example.com  | 2024-01-01
  2 | Jane Smith   | jane@example.com  | 2024-01-05
  3 | Mike Johnson | mike@example.com  | 2024-01-08
  4 | Sarah Wilson | sarah@example.com | 2024-01-09
  5 | Tom Brown    | tom@example.com   | 2024-01-11
(5 rows)

mydatabase=# SELECT * FROM payments;
 id | user_id | amount |    status    | payment_date 
----+---------+--------+--------------+--------------
  1 |       1 |  99.99 | completed    | 2024-01-10
  2 |       2 | 149.99 | completed    | 2024-01-12
  4 |       4 | 199.99 | UNSUCCESSFUL | 2024-01-13
  5 |       5 | 399.99 | IN_PROGRESS  | 2024-01-13
  3 |       3 | 299.99 | completed    | 2024-01-13
(5 rows)

mydatabase=# SELECT * FROM orders;
 id | payment_id |  product_name  | quantity | order_date 
----+------------+----------------+----------+------------
  1 |          1 | Laptop         |        1 | 2024-01-10
  2 |          2 | Smartphone     |        2 | 2024-01-12
  3 |          3 | Gaming Console |        1 | 2024-01-13
  4 |          5 | 4K TV          |        1 | 2024-01-13
(4 rows)
```

## License
This MCP server is licensed under the MIT License. This means you are free to use, modify, and distribute the software, subject to the terms and conditions of the MIT License. For more details, please see the LICENSE file in the project repository.