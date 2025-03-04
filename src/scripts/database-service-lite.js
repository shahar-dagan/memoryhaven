const path = require("path");
const fs = require("fs");
const sqlite3 = require("sqlite3").verbose();
const { app } = require("electron");

// Path to store the database
const userDataPath = app.getPath("userData");
const dbPath = path.join(userDataPath, "memoryhaven.db");

// Database connection
let db = null;
let isInitialized = false;

// Initialize database
function initializeDatabase() {
  return new Promise((resolve, reject) => {
    try {
      console.log(`Initializing database at: ${dbPath}`);

      // Create database directory if it doesn't exist
      const dbDir = path.dirname(dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      // Open database connection
      db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          console.error("Error opening database:", err);
          reject(err);
          return;
        }

        // Create tables
        createTables()
          .then(() => {
            isInitialized = true;
            console.log("Database initialized successfully");
            resolve(true);
          })
          .catch((err) => {
            console.error("Error creating tables:", err);
            reject(err);
          });
      });
    } catch (error) {
      console.error("Error initializing database:", error);
      reject(error);
    }
  });
}

// Create database tables
function createTables() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Create entries table
      db.run(
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
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `,
        (err) => {
          if (err) {
            reject(err);
            return;
          }

          // Create tags table
          db.run(
            `
          CREATE TABLE IF NOT EXISTS tags (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE
          )
        `,
            (err) => {
              if (err) {
                reject(err);
                return;
              }

              // Create entry_tags junction table
              db.run(
                `
            CREATE TABLE IF NOT EXISTS entry_tags (
              entry_id INTEGER,
              tag_id INTEGER,
              PRIMARY KEY (entry_id, tag_id),
              FOREIGN KEY (entry_id) REFERENCES entries (id) ON DELETE CASCADE,
              FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE
            )
          `,
                (err) => {
                  if (err) {
                    reject(err);
                    return;
                  }

                  console.log("Database tables created");
                  resolve();
                }
              );
            }
          );
        }
      );
    });
  });
}

// Helper function to ensure database is initialized
function ensureDbIsInitialized() {
  if (!isInitialized || !db) {
    throw new Error(
      "Database is not initialized. Call initializeDatabase() first."
    );
  }
}

// Add entry to database
function addEntry(entry) {
  return new Promise((resolve, reject) => {
    try {
      ensureDbIsInitialized();

      const stmt = db.prepare(`
        INSERT INTO entries (
          title, date, time, original_path, compressed_path, 
          transcription, duration, file_size, compressed_size
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        entry.title || null,
        entry.date,
        entry.time,
        entry.originalPath,
        entry.compressedPath || null,
        entry.transcription || null,
        entry.duration || null,
        entry.fileSize || null,
        entry.compressedSize || null,
        function (err) {
          if (err) {
            reject(err);
            return;
          }

          const entryId = this.lastID;

          // Add tags if provided
          if (
            entry.tags &&
            Array.isArray(entry.tags) &&
            entry.tags.length > 0
          ) {
            addTagsToEntry(entryId, entry.tags)
              .then(() => {
                resolve({
                  success: true,
                  entryId: entryId,
                });
              })
              .catch(reject);
          } else {
            resolve({
              success: true,
              entryId: entryId,
            });
          }
        }
      );

      stmt.finalize();
    } catch (error) {
      reject(error);
    }
  });
}

// Update an entry
function updateEntry(id, updates) {
  return new Promise((resolve, reject) => {
    try {
      ensureDbIsInitialized();

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
        resolve({ success: false, error: "No valid fields to update" });
        return;
      }

      // Add ID as the last parameter
      values.push(id);

      const query = `UPDATE entries SET ${fields.join(", ")} WHERE id = ?`;

      db.run(query, values, function (err) {
        if (err) {
          reject(err);
          return;
        }

        // Update tags if provided
        if (updates.tags && Array.isArray(updates.tags)) {
          // Remove existing tags
          db.run("DELETE FROM entry_tags WHERE entry_id = ?", [id], (err) => {
            if (err) {
              reject(err);
              return;
            }

            // Add new tags
            addTagsToEntry(id, updates.tags)
              .then(() => {
                resolve({
                  success: true,
                  changes: this.changes,
                });
              })
              .catch(reject);
          });
        } else {
          resolve({
            success: true,
            changes: this.changes,
          });
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

// Get entry by ID
function getEntryById(id) {
  return new Promise((resolve, reject) => {
    try {
      ensureDbIsInitialized();

      db.get("SELECT * FROM entries WHERE id = ?", [id], (err, entry) => {
        if (err) {
          reject(err);
          return;
        }

        if (!entry) {
          resolve({ success: false, error: "Entry not found" });
          return;
        }

        // Get tags for this entry
        db.all(
          `
          SELECT t.name FROM tags t
          JOIN entry_tags et ON t.id = et.tag_id
          WHERE et.entry_id = ?
        `,
          [id],
          (err, tags) => {
            if (err) {
              reject(err);
              return;
            }

            const tagNames = tags.map((tag) => tag.name);

            resolve({
              success: true,
              entry: { ...entry, tags: tagNames },
            });
          }
        );
      });
    } catch (error) {
      reject(error);
    }
  });
}

// Get all entries
function getAllEntries(limit = 100, offset = 0) {
  return new Promise((resolve, reject) => {
    try {
      ensureDbIsInitialized();

      db.all(
        `
        SELECT * FROM entries
        ORDER BY date DESC, time DESC
        LIMIT ? OFFSET ?
      `,
        [limit, offset],
        (err, entries) => {
          if (err) {
            reject(err);
            return;
          }

          // If no entries, return empty array
          if (!entries || entries.length === 0) {
            resolve({
              success: true,
              entries: [],
            });
            return;
          }

          // Get tags for each entry
          const promises = entries.map((entry) => {
            return new Promise((resolve, reject) => {
              db.all(
                `
              SELECT t.name FROM tags t
              JOIN entry_tags et ON t.id = et.tag_id
              WHERE et.entry_id = ?
            `,
                [entry.id],
                (err, tags) => {
                  if (err) {
                    reject(err);
                    return;
                  }

                  entry.tags = tags.map((tag) => tag.name);
                  resolve(entry);
                }
              );
            });
          });

          Promise.all(promises)
            .then((entriesWithTags) => {
              resolve({
                success: true,
                entries: entriesWithTags,
              });
            })
            .catch(reject);
        }
      );
    } catch (error) {
      reject(error);
    }
  });
}

// Delete an entry
function deleteEntry(id) {
  return new Promise((resolve, reject) => {
    try {
      ensureDbIsInitialized();

      // Get the entry to find file paths
      db.get(
        "SELECT original_path, compressed_path FROM entries WHERE id = ?",
        [id],
        (err, entry) => {
          if (err) {
            reject(err);
            return;
          }

          if (!entry) {
            resolve({ success: false, error: "Entry not found" });
            return;
          }

          // Delete the entry (cascade will delete related tags)
          db.run("DELETE FROM entries WHERE id = ?", [id], function (err) {
            if (err) {
              reject(err);
              return;
            }

            resolve({
              success: true,
              changes: this.changes,
              filePaths: {
                originalPath: entry.original_path,
                compressedPath: entry.compressed_path,
              },
            });
          });
        }
      );
    } catch (error) {
      reject(error);
    }
  });
}

// Search entries
function searchEntries(query) {
  return new Promise((resolve, reject) => {
    try {
      ensureDbIsInitialized();

      const searchTerm = `%${query}%`;

      db.all(
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
      `,
        [searchTerm, searchTerm, searchTerm],
        (err, entries) => {
          if (err) {
            reject(err);
            return;
          }

          // If no entries, return empty array
          if (!entries || entries.length === 0) {
            resolve({
              success: true,
              entries: [],
            });
            return;
          }

          // Get tags for each entry
          const promises = entries.map((entry) => {
            return new Promise((resolve, reject) => {
              db.all(
                `
              SELECT t.name FROM tags t
              JOIN entry_tags et ON t.id = et.tag_id
              WHERE et.entry_id = ?
            `,
                [entry.id],
                (err, tags) => {
                  if (err) {
                    reject(err);
                    return;
                  }

                  entry.tags = tags.map((tag) => tag.name);
                  resolve(entry);
                }
              );
            });
          });

          Promise.all(promises)
            .then((entriesWithTags) => {
              resolve({
                success: true,
                entries: entriesWithTags,
              });
            })
            .catch(reject);
        }
      );
    } catch (error) {
      reject(error);
    }
  });
}

// Add tags to an entry
function addTagsToEntry(entryId, tagNames) {
  return new Promise((resolve, reject) => {
    try {
      ensureDbIsInitialized();

      // Use a transaction for adding tags
      db.serialize(() => {
        db.run("BEGIN TRANSACTION");

        const insertTagStmt = db.prepare(
          "INSERT OR IGNORE INTO tags (name) VALUES (?)"
        );
        const getTagIdStmt = db.prepare("SELECT id FROM tags WHERE name = ?");
        const linkTagStmt = db.prepare(
          "INSERT OR IGNORE INTO entry_tags (entry_id, tag_id) VALUES (?, ?)"
        );

        let hasError = false;
        let completedTags = 0;

        // If no tags, resolve immediately
        if (!tagNames || tagNames.length === 0) {
          db.run("COMMIT", (err) => {
            if (err) {
              reject(err);
              return;
            }
            resolve({ success: true });
          });
          return;
        }

        tagNames.forEach((tagName) => {
          // Insert tag if it doesn't exist
          insertTagStmt.run(tagName, (err) => {
            if (err && !hasError) {
              hasError = true;
              db.run("ROLLBACK");
              reject(err);
              return;
            }

            // Get tag ID
            getTagIdStmt.get(tagName, (err, tag) => {
              if (err && !hasError) {
                hasError = true;
                db.run("ROLLBACK");
                reject(err);
                return;
              }

              // Link tag to entry
              if (tag && tag.id) {
                linkTagStmt.run(entryId, tag.id, (err) => {
                  if (err && !hasError) {
                    hasError = true;
                    db.run("ROLLBACK");
                    reject(err);
                    return;
                  }

                  completedTags++;

                  // If all tags are processed, commit the transaction
                  if (completedTags === tagNames.length && !hasError) {
                    db.run("COMMIT", (err) => {
                      if (err) {
                        reject(err);
                        return;
                      }

                      resolve({ success: true });
                    });
                  }
                });
              } else {
                completedTags++;

                // If all tags are processed, commit the transaction
                if (completedTags === tagNames.length && !hasError) {
                  db.run("COMMIT", (err) => {
                    if (err) {
                      reject(err);
                      return;
                    }

                    resolve({ success: true });
                  });
                }
              }
            });
          });
        });

        insertTagStmt.finalize();
        getTagIdStmt.finalize();
        linkTagStmt.finalize();
      });
    } catch (error) {
      reject(error);
    }
  });
}

// Get all tags
function getAllTags() {
  return new Promise((resolve, reject) => {
    try {
      ensureDbIsInitialized();

      db.all("SELECT * FROM tags ORDER BY name", (err, tags) => {
        if (err) {
          reject(err);
          return;
        }

        resolve({
          success: true,
          tags: tags,
        });
      });
    } catch (error) {
      reject(error);
    }
  });
}

// Extract tags from transcription (simple implementation)
function extractTagsFromTranscription(transcription) {
  if (!transcription) return [];

  // Look for hashtags in the transcription
  const hashtagRegex = /#(\w+)/g;
  const matches = transcription.match(hashtagRegex);

  if (!matches) return [];

  // Remove the # and return unique tags
  return [...new Set(matches.map((tag) => tag.substring(1)))];
}

// Close database connection
function closeDatabase() {
  return new Promise((resolve, reject) => {
    if (db) {
      db.close((err) => {
        if (err) {
          console.error("Error closing database:", err);
          reject(err);
          return;
        }

        console.log("Database connection closed");
        isInitialized = false;
        db = null;
        resolve();
      });
    } else {
      resolve();
    }
  });
}

module.exports = {
  initializeDatabase,
  addEntry,
  updateEntry,
  getEntryById,
  getAllEntries,
  deleteEntry,
  searchEntries,
  getAllTags,
  extractTagsFromTranscription,
  closeDatabase,
};
