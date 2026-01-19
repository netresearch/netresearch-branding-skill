---
name: "branded-docs"
description: "Netresearch-branded documentation style"
---

# Netresearch Branded Documentation Style

For technical documentation in Netresearch projects:

## README Header

```markdown
# [n] {Project Name}

[![Netresearch](https://img.shields.io/badge/by-Netresearch-2F99A4)](https://www.netresearch.de)

{Brief project description in 1-2 sentences}
```

## Installation Section

```markdown
## Installation

### Requirements

- {requirement 1}
- {requirement 2}

### Quick Start

\`\`\`bash
# Installation commands
composer require netresearch/{package}
\`\`\`
```

## Usage Section

```markdown
## Usage

### Basic Example

\`\`\`php
// Code example with clear comments
\`\`\`

### Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `option` | string | `'value'` | What it does |
```

## Contributing Section

```markdown
## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md).

### Development Setup

1. Clone the repository
2. Install dependencies
3. Run tests

### Code Style

- Follow PSR-12
- Add tests for new features
- Update documentation
```

## Footer

```markdown
---

## License

MIT License - see [LICENSE](LICENSE)

## Support

- [GitHub Issues](https://github.com/netresearch/{repo}/issues)
- [Netresearch Website](https://www.netresearch.de)

---

Made with ❤️ by [Netresearch](https://www.netresearch.de)
```
