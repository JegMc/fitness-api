const Database = require("better-sqlite3");

// Open or create the database file
const db = new Database("fitness.db");

// Enable foreign key constraints
db.pragma("foreign_keys = ON");

module.exports = db;
