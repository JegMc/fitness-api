const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const db = new Database("fitness.db");
db.pragma("foreign_keys = ON");

const schemaPath = path.join(__dirname, "schema.sql");
const schemaSql = fs.readFileSync(schemaPath, "utf8");
db.exec(schemaSql);

module.exports = db;
