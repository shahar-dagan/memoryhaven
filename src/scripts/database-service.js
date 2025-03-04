const path = require("path");
const Database = require("better-sqlite3");
const { app } = require("electron");

// Path to store the database
const userDataPath = app.getPath("userData");
const dbPath = path.join(userDataPath, "memoryhaven.db");

// Initialize database
let db;

function initializeDatabase() {
  try {
    console.log(`Initializing database at: ${dbPath}`);
    db = new Database(dbPath, { verbose: console.log });

    // Create tables if they don't exist
    createTables();

    console.log("Database initialized successfully");
    return true;
  } catch (error) {
    console.error("Error initializing database:", error);
    return false;
  }
}

function createTables() {
  // Create entries table
  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      original_path TEXT NOT NULL,
      compressed_path TEXT,
      transcription TEXT,
      duration INTEGER,
      file_size INTEGER,
      compressed_size INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `
  ).run();

  // Create tags table
  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    )
  `
  ).run();

  // Create entry_tags junction table
  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS entry_tags (
      entry_id INTEGER,
      tag_id INTEGER,
      PRIMARY KEY (entry_id, tag_id),
      FOREIGN KEY (entry_id) REFERENCES entries (id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE
    )
  `
  ).run();

  console.log("Database tables created");
}

// Entry operations
function addEntry(entry) {
  try {
    const stmt = db.prepare(`
      INSERT INTO entries (
        title, date, time, original_path, compressed_path, 
        transcription, duration, file_size, compressed_size
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      entry.title || null,
      entry.date,
      entry.time,
      entry.originalPath,
      entry.compressedPath || null,
      entry.transcription || null,
      entry.duration || null,
      entry.fileSize || null,
      entry.compressedSize || null
    );

    console.log(`Added entry with ID: ${result.lastInsertRowid}`);

    // Add tags if provided
    if (entry.tags && Array.isArray(entry.tags) && entry.tags.length > 0) {
      addTagsToEntry(result.lastInsertRowid, entry.tags);
    }

    return {
      success: true,
      entryId: result.lastInsertRowid,
    };
  } catch (error) {
    console.error("Error adding entry:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

function updateEntry(id, updates) {
  try {
    // Build the SET part of the query dynamically based on provided updates
    const fields = [];
    const values = [];

    Object.entries(updates).forEach(([key, value]) => {
      // Convert camelCase to snake_case for database fields
      const fieldName = key.replace(/([A-Z])/g, "_$1").toLowerCase();

      if (
        fieldName !== "id" &&
        fieldName !== "created_at" &&
        fieldName !== "tags"
      ) {
        fields.push(`${fieldName} = ?`);
        values.push(value);
      }
    });

    if (fields.length === 0) {
      return { success: false, error: "No valid fields to update" };
    }

    // Add ID as the last parameter
    values.push(id);

    const stmt = db.prepare(`
      UPDATE entries SET ${fields.join(", ")} WHERE id = ?
    `);

    const result = stmt.run(...values);

    // Update tags if provided
    if (updates.tags && Array.isArray(updates.tags)) {
      // Remove existing tags
      db.prepare("DELETE FROM entry_tags WHERE entry_id = ?").run(id);

      // Add new tags
      addTagsToEntry(id, updates.tags);
    }

    return {
      success: true,
      changes: result.changes,
    };
  } catch (error) {
    console.error("Error updating entry:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

function getEntryById(id) {
  try {
    const entry = db.prepare("SELECT * FROM entries WHERE id = ?").get(id);

    if (!entry) {
      return { success: false, error: "Entry not found" };
    }

    // Get tags for this entry
    const tags = db
      .prepare(
        `
      SELECT t.name FROM tags t
      JOIN entry_tags et ON t.id = et.tag_id
      WHERE et.entry_id = ?
    `
      )
      .all(id)
      .map((tag) => tag.name);

    return {
      success: true,
      entry: { ...entry, tags },
    };
  } catch (error) {
    console.error("Error getting entry:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

function getAllEntries(limit = 100, offset = 0) {
  try {
    const entries = db
      .prepare(
        `
      SELECT * FROM entries
      ORDER BY date DESC, time DESC
      LIMIT ? OFFSET ?
    `
      )
      .all(limit, offset);

    // Get tags for each entry
    const entriesWithTags = entries.map((entry) => {
      const tags = db
        .prepare(
          `
        SELECT t.name FROM tags t
        JOIN entry_tags et ON t.id = et.tag_id
        WHERE et.entry_id = ?
      `
        )
        .all(entry.id)
        .map((tag) => tag.name);

      return { ...entry, tags };
    });

    return {
      success: true,
      entries: entriesWithTags,
    };
  } catch (error) {
    console.error("Error getting entries:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

function deleteEntry(id) {
  try {
    // Get the entry to find file paths
    const entry = db
      .prepare(
        "SELECT original_path, compressed_path FROM entries WHERE id = ?"
      )
      .get(id);

    if (!entry) {
      return { success: false, error: "Entry not found" };
    }

    // Delete the entry (cascade will delete related tags)
    const result = db.prepare("DELETE FROM entries WHERE id = ?").run(id);

    return {
      success: true,
      changes: result.changes,
      filePaths: {
        originalPath: entry.original_path,
        compressedPath: entry.compressed_path,
      },
    };
  } catch (error) {
    console.error("Error deleting entry:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Tag operations
function addTag(name) {
  try {
    const stmt = db.prepare("INSERT OR IGNORE INTO tags (name) VALUES (?)");
    const result = stmt.run(name);

    if (result.changes === 0) {
      // Tag already exists, get its ID
      const tag = db.prepare("SELECT id FROM tags WHERE name = ?").get(name);
      return {
        success: true,
        tagId: tag.id,
        alreadyExists: true,
      };
    }

    return {
      success: true,
      tagId: result.lastInsertRowid,
      alreadyExists: false,
    };
  } catch (error) {
    console.error("Error adding tag:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

function addTagsToEntry(entryId, tagNames) {
  try {
    const insertTagStmt = db.prepare(
      "INSERT OR IGNORE INTO tags (name) VALUES (?)"
    );
    const getTagIdStmt = db.prepare("SELECT id FROM tags WHERE name = ?");
    const linkTagStmt = db.prepare(
      "INSERT OR IGNORE INTO entry_tags (entry_id, tag_id) VALUES (?, ?)"
    );

    // Start a transaction
    const transaction = db.transaction((entryId, tagNames) => {
      tagNames.forEach((tagName) => {
        // Insert tag if it doesn't exist
        insertTagStmt.run(tagName);

        // Get tag ID
        const tag = getTagIdStmt.get(tagName);

        // Link tag to entry
        linkTagStmt.run(entryId, tag.id);
      });
    });

    transaction(entryId, tagNames);

    return { success: true };
  } catch (error) {
    console.error("Error adding tags to entry:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

function getAllTags() {
  try {
    const tags = db.prepare("SELECT * FROM tags ORDER BY name").all();

    return {
      success: true,
      tags,
    };
  } catch (error) {
    console.error("Error getting tags:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Search operations
function searchEntries(query) {
  try {
    const searchTerm = `%${query}%`;

    const entries = db
      .prepare(
        `
      SELECT e.* FROM entries e
      WHERE e.title LIKE ?
      OR e.transcription LIKE ?
      OR EXISTS (
        SELECT 1 FROM tags t
        JOIN entry_tags et ON t.id = et.tag_id
        WHERE et.entry_id = e.id AND t.name LIKE ?
      )
      ORDER BY e.date DESC, e.time DESC
    `
      )
      .all(searchTerm, searchTerm, searchTerm);

    // Get tags for each entry
    const entriesWithTags = entries.map((entry) => {
      const tags = db
        .prepare(
          `
        SELECT t.name FROM tags t
        JOIN entry_tags et ON t.id = et.tag_id
        WHERE et.entry_id = ?
      `
        )
        .all(entry.id)
        .map((tag) => tag.name);

      return { ...entry, tags };
    });

    return {
      success: true,
      entries: entriesWithTags,
    };
  } catch (error) {
    console.error("Error searching entries:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Close database connection
function closeDatabase() {
  if (db) {
    db.close();
    console.log("Database connection closed");
  }
}

module.exports = {
  initializeDatabase,
  addEntry,
  updateEntry,
  getEntryById,
  getAllEntries,
  deleteEntry,
  addTag,
  addTagsToEntry,
  getAllTags,
  searchEntries,
  closeDatabase,
};
