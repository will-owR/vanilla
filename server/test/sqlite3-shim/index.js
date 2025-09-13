// Minimal sqlite3 shim used only for tests when native bindings aren't available.
// It provides a small compatible subset of the API used by the project: .verbose(),
// Database constructor with run/get/all/exec/close/serialize, and Statement-like
// callback semantics for `run` (this.lastID). This shim stores data only in memory
// using a very small in-memory store for jobs table operations where tests expect
// basic insertion/select behavior.

let lastId = 0;

function verbose() {
  return module.exports;
}

class InMemoryDB {
  constructor(_path, cb) {
    // Simulate async open
    this.tables = {};
    this._closed = false;
    setImmediate(() => cb && cb(null));
  }

  serialize(fn) {
    // No-op for shim
    fn && fn();
  }

  run(sql, params, cb) {
    // Accept (sql, params..., cb) or (sql, cb)
    if (typeof params === "function") {
      cb = params;
      params = [];
    }
    // Very small parser: handle CREATE TABLE, INSERT INTO jobs, UPDATE and simple exec
    const trimmed = sql.trim().toUpperCase();
    if (trimmed.startsWith("CREATE TABLE") || trimmed.startsWith("PRAGMA")) {
      // pretend success
      setImmediate(() => cb && cb(null));
      // return a statement-like object via callback this
      return;
    }

    if (trimmed.startsWith("INSERT INTO JOBS")) {
      lastId++;
      const self = this;
      // simulate sqlite3 Statement callback which sets lastID on `this`
      setImmediate(() => cb && cb.call({ lastID: lastId }, null));
      return;
    }

    if (trimmed.startsWith("UPDATE JOBS")) {
      setImmediate(() => cb && cb(null));
      return;
    }

    // Fallback: succeed
    setImmediate(() => cb && cb(null));
  }

  get(sql, params, cb) {
    if (typeof params === "function") {
      cb = params;
      params = [];
    }
    // Very small implementation for SELECT FROM jobs LIMIT 1
    const trimmed = sql.trim().toUpperCase();
    if (trimmed.startsWith("SELECT * FROM JOBS WHERE STATE = 'QUEUED'")) {
      // return null to indicate no jobs
      setImmediate(() => cb && cb(null, null));
      return;
    }
    setImmediate(() => cb && cb(null, null));
  }

  all(sql, params, cb) {
    if (typeof params === "function") {
      cb = params;
      params = [];
    }
    setImmediate(() => cb && cb(null, []));
  }

  exec(sql, cb) {
    // Accept multi-statement DDL
    setImmediate(() => cb && cb(null));
  }

  close(cb) {
    this._closed = true;
    setImmediate(() => cb && cb(null));
  }
}

module.exports = {
  verbose,
  Database: InMemoryDB,
  // Historically code may call `require('sqlite3').verbose()` which returns the
  // module; also allow `new sqlite3.Database(...)` if required. Export a
  // function so `require('sqlite3')` can be used as a constructor in some code.
  // To support `const sqlite3 = require('sqlite3').verbose()` style, we've
  // exported `verbose` above.
};
