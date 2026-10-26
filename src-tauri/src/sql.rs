//! Base SQLite privée de chaque extension (permission `storage.sql`) : `<root>/data/<id>/db.sqlite`.
//! Aucune autre base n'est accessible : `ATTACH` est désactivé et la taille est plafonnée.

use base64::engine::general_purpose::STANDARD as B64;
use base64::Engine;
use rusqlite::limits::Limit;
use rusqlite::types::{Value as SqlValue, ValueRef};
use rusqlite::Connection;
use serde::Serialize;
use serde_json::Value;
use std::path::Path;
use std::time::Duration;

/// 50 Mo avec des pages de 4 Ko.
const MAX_PAGES: u32 = 12_800;
const MAX_ROWS: usize = 10_000;

pub fn open(data_dir: &Path, ext_id: &str) -> Result<Connection, String> {
    let dir = data_dir.join(ext_id);
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let conn = Connection::open(dir.join("db.sqlite")).map_err(|e| e.to_string())?;
    conn.set_limit(Limit::SQLITE_LIMIT_ATTACHED, 0).map_err(|e| e.to_string())?;
    conn.busy_timeout(Duration::from_secs(3)).map_err(|e| e.to_string())?;
    conn.execute_batch(&format!("PRAGMA max_page_count = {MAX_PAGES}; PRAGMA foreign_keys = ON;"))
        .map_err(|e| e.to_string())?;
    Ok(conn)
}

#[derive(Debug, Serialize)]
pub struct QueryResult {
    pub columns: Vec<String>,
    pub rows: Vec<Vec<Value>>,
    pub changes: usize,
    pub truncated: bool,
}

fn to_sql(v: &Value) -> SqlValue {
    match v {
        Value::Null => SqlValue::Null,
        Value::Bool(b) => SqlValue::Integer(*b as i64),
        Value::Number(n) => {
            n.as_i64().map(SqlValue::Integer).unwrap_or_else(|| SqlValue::Real(n.as_f64().unwrap_or(0.0)))
        }
        Value::String(s) => SqlValue::Text(s.clone()),
        other => SqlValue::Text(other.to_string()),
    }
}

fn to_json(v: ValueRef<'_>) -> Value {
    match v {
        ValueRef::Null => Value::Null,
        ValueRef::Integer(i) => Value::from(i),
        ValueRef::Real(f) => Value::from(f),
        ValueRef::Text(t) => Value::from(String::from_utf8_lossy(t).into_owned()),
        // Les BLOB sont transmis en base64
        ValueRef::Blob(b) => serde_json::json!({ "$blob": B64.encode(b) }),
    }
}

/// Une instruction, avec paramètres positionnels (`?`).
pub fn query(conn: &Connection, sql: &str, params: &[Value]) -> Result<QueryResult, String> {
    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let params: Vec<SqlValue> = params.iter().map(to_sql).collect();
    let bind = rusqlite::params_from_iter(params.iter());
    if stmt.column_count() == 0 {
        let changes = stmt.execute(bind).map_err(|e| e.to_string())?;
        return Ok(QueryResult { columns: vec![], rows: vec![], changes, truncated: false });
    }
    let columns: Vec<String> = stmt.column_names().map(str::to_owned).collect();
    let n = columns.len();
    let mut rows = Vec::new();
    let mut truncated = false;
    let mut cursor = stmt.query(bind).map_err(|e| e.to_string())?;
    while let Some(row) = cursor.next().map_err(|e| e.to_string())? {
        if rows.len() == MAX_ROWS {
            truncated = true;
            break;
        }
        rows.push((0..n).map(|i| row.get_ref(i).map(to_json).unwrap_or(Value::Null)).collect());
    }
    Ok(QueryResult { columns, rows, changes: 0, truncated })
}

/// Script de plusieurs instructions (création de tables, migrations).
pub fn exec(conn: &Connection, script: &str) -> Result<(), String> {
    conn.execute_batch(script).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn private_database_roundtrip() {
        let tmp = tempfile::tempdir().unwrap();
        let conn = open(tmp.path(), "test.crm").unwrap();
        exec(&conn, "CREATE TABLE client (id INTEGER PRIMARY KEY, nom TEXT, ca REAL, photo BLOB);").unwrap();
        let ins = query(
            &conn,
            "INSERT INTO client (nom, ca, photo) VALUES (?, ?, x'0102')",
            &[Value::from("Dupont"), Value::from(12.5)],
        )
        .unwrap();
        assert_eq!(ins.changes, 1);
        let r = query(&conn, "SELECT id, nom, ca, photo FROM client WHERE nom = ?", &[Value::from("Dupont")]).unwrap();
        assert_eq!(r.columns, vec!["id", "nom", "ca", "photo"]);
        assert_eq!(r.rows[0][1], Value::from("Dupont"));
        assert_eq!(r.rows[0][3]["$blob"], Value::from("AQI="));
        assert!(tmp.path().join("test.crm/db.sqlite").exists());
    }

    #[test]
    fn cannot_attach_other_databases() {
        let tmp = tempfile::tempdir().unwrap();
        let other = tmp.path().join("autre.sqlite");
        Connection::open(&other).unwrap().execute_batch("CREATE TABLE secret (x);").unwrap();
        let conn = open(tmp.path(), "test.a").unwrap();
        let sql = format!("ATTACH DATABASE '{}' AS a", other.display());
        assert!(exec(&conn, &sql).is_err());
        assert!(query(&conn, "SELECT 1 FROM nope", &[]).is_err());
    }
}
