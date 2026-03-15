import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize SQLite Database
const db = new Database("app.db");

// Create admin_settings table
db.exec(`
  CREATE TABLE IF NOT EXISTS admin_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    setting_key TEXT UNIQUE NOT NULL,
    setting_value TEXT NOT NULL,
    description TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Insert default settings if they don't exist
const insertDefault = db.prepare(`
  INSERT OR IGNORE INTO admin_settings (setting_key, setting_value, description)
  VALUES (?, ?, ?)
`);

insertDefault.run("site_name", "Aplikasi Saya", "Nama aplikasi yang ditampilkan di header");
insertDefault.run("maintenance_mode", "false", "Status mode perbaikan (true/false)");
insertDefault.run("max_users", "100", "Batas maksimal pengguna yang bisa mendaftar");
insertDefault.run("theme_color", "#3b82f6", "Warna tema utama aplikasi");

// API Routes
app.get("/api/settings", (req, res) => {
  try {
    const settings = db.prepare("SELECT * FROM admin_settings").all();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: "Gagal mengambil pengaturan" });
  }
});

app.put("/api/settings/:key", (req, res) => {
  const { key } = req.params;
  const { value } = req.body;
  
  if (value === undefined) {
    return res.status(400).json({ error: "Nilai pengaturan tidak boleh kosong" });
  }

  try {
    const stmt = db.prepare(`
      UPDATE admin_settings 
      SET setting_value = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE setting_key = ?
    `);
    const info = stmt.run(String(value), key);
    
    if (info.changes === 0) {
      return res.status(404).json({ error: "Pengaturan tidak ditemukan" });
    }
    
    res.json({ success: true, message: "Pengaturan berhasil diperbarui" });
  } catch (error) {
    res.status(500).json({ error: "Gagal memperbarui pengaturan" });
  }
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
