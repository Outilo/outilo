//! Stockage clé/valeur privé de chaque extension : `<root>/data/<id>/kv.json`.

use serde_json::{Map, Value};
use std::fs;
use std::path::{Path, PathBuf};

/// Taille maximale du stockage d'une extension.
const MAX_BYTES: usize = 5 * 1024 * 1024;

pub struct KvStore {
    file: PathBuf,
}

impl KvStore {
    pub fn new(data_dir: &Path, ext_id: &str) -> Self {
        Self { file: data_dir.join(ext_id).join("kv.json") }
    }

    fn read(&self) -> Map<String, Value> {
        fs::read_to_string(&self.file).ok().and_then(|s| serde_json::from_str(&s).ok()).unwrap_or_default()
    }

    fn write(&self, map: &Map<String, Value>) -> Result<(), String> {
        let json = serde_json::to_vec(map).map_err(|e| e.to_string())?;
        if json.len() > MAX_BYTES {
            return Err("stockage plein (5 Mo maximum par extension)".into());
        }
        crate::fsutil::write_atomic(&self.file, &json)
    }

    pub fn get(&self, key: &str) -> Value {
        self.read().remove(key).unwrap_or(Value::Null)
    }

    pub fn set(&self, key: &str, value: Value) -> Result<(), String> {
        let mut map = self.read();
        map.insert(key.to_owned(), value);
        self.write(&map)
    }

    pub fn remove(&self, key: &str) -> Result<(), String> {
        let mut map = self.read();
        if map.remove(key).is_some() {
            self.write(&map)?;
        }
        Ok(())
    }

    pub fn keys(&self) -> Vec<String> {
        self.read().keys().cloned().collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn roundtrip_and_isolation() {
        let tmp = tempfile::tempdir().unwrap();
        let a = KvStore::new(tmp.path(), "test.a");
        let b = KvStore::new(tmp.path(), "test.b");
        a.set("length", json!(24)).unwrap();
        assert_eq!(a.get("length"), json!(24));
        assert_eq!(b.get("length"), Value::Null, "une extension ne voit pas les données d'une autre");
        a.remove("length").unwrap();
        assert!(a.keys().is_empty());
    }

    #[test]
    fn enforces_quota() {
        let tmp = tempfile::tempdir().unwrap();
        let s = KvStore::new(tmp.path(), "test.a");
        assert!(s.set("big", json!("x".repeat(MAX_BYTES + 1))).is_err());
    }
}
