# Maestro Builder Tests

This directory contains tests for the Maestro Builder application.

## Test Files

- `test_validation.py` - Tests for YAML validation functionality
- `test_api.py` - Tests for API endpoints
- `test_frontend.py` - Tests for frontend structure and dependencies
- `complex_agents.yaml` - Complex multi-agent YAML file for testing validation

## Running Tests

### Local Testing

```bash
# Run all tests
pytest tests/ -v

# Run specific test categories
pytest tests/test_validation.py -v
pytest tests/test_api.py -v
pytest tests/test_frontend.py -v

# Run specific test
pytest tests/test_frontend.py::test_frontend_files_exist -v
```

### CI/CD Testing

Tests are automatically run via GitHub Actions on:
- Pull requests to `main` branch

## Test Coverage

### Validation Tests
1. **Direct maestro validation** - Tests that `maestro validate` works correctly with complex YAML files
2. **API validation endpoint (mocked)** - Tests the `/api/validate_yaml` endpoint using mocking
3. **Error handling** - Tests both success and failure scenarios with mocked responses
4. **Double-escaping handling** - Tests that the API correctly handles frontend-escaped YAML content

### API Tests
1. **Health endpoint** - Tests the `/api/health` endpoint
2. **Root endpoint** - Tests the root API endpoint

### Frontend Tests
1. **File structure** - Verifies essential frontend files exist
2. **Component structure** - Checks YamlPanel component has required functionality
3. **API service** - Validates API service has expected methods and interfaces
4. **Dependencies** - Ensures package.json has required dependencies
5. **Build configuration** - Tests Vite configuration is valid

## Test Approach

### Mocking Strategy
- **No real server required** - API tests use mocking to avoid starting actual servers
- **Fast and reliable** - Tests run quickly without external dependencies
- **Comprehensive coverage** - Tests both success and error cases
- **CI-friendly** - Works reliably in automated environments

### Test Types
- **Direct validation** - Tests `maestro validate` command directly
- **API function testing** - Tests the validation function with mocked subprocess calls
- **Error case testing** - Tests how the API handles validation failures
- **Frontend structure testing** - Tests file existence and basic structure without running servers

## Adding New Tests

To add new tests:

1. Create test files in this directory following pytest conventions
2. Use descriptive test function names starting with `test_`
3. Use mocking for API tests to avoid external dependencies
4. Ensure tests handle both success and failure cases
5. Add tests to appropriate categories (validation, API, frontend) 