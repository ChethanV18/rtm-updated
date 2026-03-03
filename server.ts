import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const db = new Database("rtm.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS requirements (
    id TEXT PRIMARY KEY,
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
    const { id, description, dev, test, report, deploy, usage, remarks, status } = req.body;
    try {
      const stmt = db.prepare(`
        INSERT INTO requirements (id, description, dev, test, report, deploy, usage, remarks, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          description=excluded.description,
          dev=excluded.dev,
          test=excluded.test,
          report=excluded.report,
          deploy=excluded.deploy,
          usage=excluded.usage,
          remarks=excluded.remarks,
          status=excluded.status
      `);
      stmt.run(id, description, dev, test, report, deploy, usage, remarks, status);
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to save requirement" });
    }
  });

  app.post("/api/requirements/bulk", (req, res) => {
    const requirements = req.body;
    const insert = db.prepare(`
      INSERT INTO requirements (id, description, dev, test, report, deploy, usage, remarks, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
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
          req.id, 
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
    } catch (error) {
      res.status(500).json({ error: "Failed to bulk save requirements" });
    }
  });

  app.delete("/api/requirements/:id", (req, res) => {
    try {
      db.prepare("DELETE FROM requirements WHERE id = ?").run(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete requirement" });
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
