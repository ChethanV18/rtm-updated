import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const db = new Database("rtm.db");

// Initialize database with migration support
const tableInfo = db.prepare("PRAGMA table_info(requirements)").all() as any[];

if (tableInfo.length === 0) {
  // Table doesn't exist, create it
  db.exec(`
    CREATE TABLE requirements (
      uid TEXT PRIMARY KEY,
      requirement_id TEXT UNIQUE,
      description TEXT,
      dev TEXT DEFAULT 'pending',
      test TEXT DEFAULT 'pending',
      report TEXT DEFAULT 'pending',
      deploy TEXT DEFAULT 'pending',
      usage TEXT DEFAULT 'pending',
      remarks TEXT DEFAULT '',
      status TEXT DEFAULT 'Not Started',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
} else {
  // Table exists, check for missing columns and migrate if necessary
  const columns = tableInfo.map(col => col.name);
  
  if (!columns.includes('uid')) {
    // This is the old schema with 'id' as primary key
    // We need to migrate to the new schema
    console.log("Migrating database schema...");
    db.transaction(() => {
      // 1. Rename old table
      db.exec("ALTER TABLE requirements RENAME TO requirements_old");
      
      // 2. Create new table
      db.exec(`
        CREATE TABLE requirements (
          uid TEXT PRIMARY KEY,
          requirement_id TEXT UNIQUE,
          description TEXT,
          dev TEXT DEFAULT 'pending',
          test TEXT DEFAULT 'pending',
          report TEXT DEFAULT 'pending',
          deploy TEXT DEFAULT 'pending',
          usage TEXT DEFAULT 'pending',
          remarks TEXT DEFAULT '',
          status TEXT DEFAULT 'Not Started',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // 3. Copy data from old table
      // We'll use the old 'id' as both 'uid' and 'requirement_id' initially
      db.exec(`
        INSERT INTO requirements (uid, requirement_id, description, dev, test, report, deploy, usage, remarks, status, created_at)
        SELECT id, id, description, dev, test, report, deploy, usage, remarks, status, created_at FROM requirements_old
      `);
      
      // 4. Drop old table
      db.exec("DROP TABLE requirements_old");
    })();
    console.log("Migration complete.");
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // API Routes
  app.get("/api/requirements", (req, res) => {
    try {
      const rows = db.prepare("SELECT * FROM requirements ORDER BY created_at DESC").all();
      res.json(rows);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch requirements" });
    }
  });

  app.post("/api/requirements", (req, res) => {
    const { uid, requirement_id, description, dev, test, report, deploy, usage, remarks, status } = req.body;
    try {
      const stmt = db.prepare(`
        INSERT INTO requirements (uid, requirement_id, description, dev, test, report, deploy, usage, remarks, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(uid) DO UPDATE SET
          requirement_id=excluded.requirement_id,
          description=excluded.description,
          dev=excluded.dev,
          test=excluded.test,
          report=excluded.report,
          deploy=excluded.deploy,
          usage=excluded.usage,
          remarks=excluded.remarks,
          status=excluded.status
      `);
      stmt.run(uid, requirement_id, description, dev, test, report, deploy, usage, remarks, status);
      res.json({ success: true });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message || "Failed to save requirement" });
    }
  });

  app.post("/api/requirements/bulk", (req, res) => {
    const requirements = req.body;
    const insert = db.prepare(`
      INSERT INTO requirements (uid, requirement_id, description, dev, test, report, deploy, usage, remarks, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(uid) DO UPDATE SET
        requirement_id=excluded.requirement_id,
        description=excluded.description,
        dev=excluded.dev,
        test=excluded.test,
        report=excluded.report,
        deploy=excluded.deploy,
        usage=excluded.usage,
        remarks=excluded.remarks,
        status=excluded.status
    `);

    const transaction = db.transaction((reqs) => {
      for (const req of reqs) {
        insert.run(
          req.uid || Math.random().toString(36).substr(2, 9),
          req.requirement_id || req.id || '', 
          req.description || '', 
          req.dev || 'pending', 
          req.test || 'pending', 
          req.report || 'pending', 
          req.deploy || 'pending', 
          req.usage || 'pending', 
          req.remarks || '', 
          req.status || 'Not Started'
        );
      }
    });

    try {
      transaction(requirements);
      res.json({ success: true });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message || "Failed to bulk save requirements" });
    }
  });

  app.delete("/api/requirements/:uid", (req, res) => {
    try {
      db.prepare("DELETE FROM requirements WHERE uid = ?").run(req.params.uid);
      res.json({ success: true });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message || "Failed to delete requirement" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(process.cwd(), "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(process.cwd(), "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
