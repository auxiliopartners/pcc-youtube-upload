# PCC Youtube Upload

> Upload a media library to Youtube

## Features

- **Modern ES Modules** - Native ESM support with `"type": "module"`
- **Yarn 4** - Fast, reliable package management with Yarn Berry
- **XO** - Opinionated but configurable linting with ESLint
- **Vitest** - Lightning-fast unit testing framework
- **Pino** - High-performance JSON logging
- **dotenv** - Environment variable management
- **1Password SDK** - Secure secret management integration
- **TypeScript Support** - Type checking for JavaScript files
- **GitHub Actions** - CI/CD pipeline

## Prerequisites

- Node.js >= 20.0.0
- Yarn 4.11.0 (included via packageManager field)

## Configuration

### Environment Variables

Copy [.env.example](.env.example) to `.env` and configure:

```bash
NODE_ENV=development
DEBUG=false
OP_SERVICE_ACCOUNT_TOKEN=your_token_here
```

### XO Linting

XO is configured in [package.json](package.json) with the following options:
- 2-space indentation
- Ignores: `coverage/`, `dist/`, `logs/`
- Custom rules for Node.js preferences

Customize the `xo` field in [package.json](package.json) to adjust linting rules.

### TypeScript

TypeScript is configured for type checking JavaScript files. The [tsconfig.json](tsconfig.json) uses modern ES2022 targets and ESNext modules.

Run type checking: `npx tsc --noEmit`

### Vitest

Test configuration is in [vitest.config.js](vitest.config.js). Coverage reports are generated using v8 provider.

## Tooling Details

### Logger (Pino)

The logger is configured in [utils/logger.js](utils/logger.js):

```javascript
import logger from './utils/logger.js';

logger.info('Simple message');
logger.info({userId: 123}, 'Message with context');
logger.error({err: error}, 'Error message');
```

In development (`DEBUG=true`), logs are pretty-printed. In production, logs are JSON formatted for parsing.

See [src/examples/logger-example.js](src/examples/logger-example.js) for more examples.

### 1Password SDK

Securely retrieve secrets from 1Password:

1. Create a service account at https://developer.1password.com/
2. Set `OP_SERVICE_ACCOUNT_TOKEN` in your `.env` file
3. Reference secrets using the `op://` format

See [src/examples/secrets-example.js](src/examples/secrets-example.js) for usage examples.

### Testing with Vitest

Write tests in the `test/` directory with `.test.js` suffix:

```javascript
import {describe, it, expect} from 'vitest';

describe('My Feature', () => {
  it('should work correctly', () => {
    expect(1 + 1).toBe(2);
  });
});
```

See [test/example.test.js](test/example.test.js) for more examples.

## CI/CD

A GitHub Actions workflow is included in [.github/workflows/ci.yml](.github/workflows/ci.yml) that:
- Runs on every push and pull request
- Tests against Node.js 20.x and 22.x
- Executes linting and tests
- Generates coverage reports

## Best Practices

1. **Always use ES modules** - This project uses native ESM (`import`/`export`)
2. **Type-safe with JSDoc** - Add JSDoc comments for better IDE support
3. **Log structured data** - Use Pino's structured logging instead of `console.log`
4. **Never commit secrets** - Use `.env` files (gitignored) or 1Password SDK
5. **Write tests** - Aim for good coverage, especially for business logic
6. **Lint before commit** - Run `yarn lint:fix` to catch issues early

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Author

Tim Chambers
Email: tim@auxilio.partners
Website: https://auxilio.partners

---