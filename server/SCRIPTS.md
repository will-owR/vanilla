# Server Scripts Documentation

## Health Check Scripts

### `scripts/db-health.sh`

**Purpose**: Validates database connectivity and health status.

**Usage**:

```bash
./scripts/db-health.sh [--check=all]
```

**Options**:

- `--check=all`: Runs all database health checks (default)
- `--check=connectivity`: Tests basic database connection
- `--check=migrations`: Verifies migration status

### `scripts/smoke-health.sh`

**Purpose**: Performs comprehensive smoke tests of the server environment.

**Usage**:

```bash
./scripts/smoke-health.sh [--check=all]
```

**Options**:

- `--check=all`: Runs all smoke tests (default)
- `--check=server`: Tests server endpoints
- `--check=db`: Tests database connectivity
- `--check=puppeteer`: Validates Puppeteer setup

### `scripts/health-checks.js`

**Purpose**: Core JavaScript module implementing health check logic.

**Usage**:

```javascript
const healthChecks = require("./scripts/health-checks");
```

**Available Checks**:

- Server health status
- Database connectivity
- Puppeteer environment
- PDF generation capabilities

## Export Test Scripts

### `scripts/clean_samples.js`

**Purpose**: Cleans up sample files generated during tests.

### `scripts/run_smoke_export.sh`

**Purpose**: Runs export functionality smoke tests.

### `scripts/run_export_test_inproc.js`

**Purpose**: In-process export testing utility.
