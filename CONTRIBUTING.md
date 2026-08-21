# Contributing to nymrel-crawler-mesh

Thank you for your interest in contributing to `nymrel-crawler-mesh`! We welcome community contributions, bug fixes, benchmark improvements, and documentation enhancements.

## Development Setup

### TypeScript / Node.js Engine

```bash
# Clone the repository
git clone https://github.com/nymrel/nymrel-crawler-mesh.git
cd nymrel-crawler-mesh

# Install dependencies
npm install

# Run build
npm run build

# Run TypeScript test suite
npm test
```

### Python Engine

```bash
# Install in editable mode
pip install -e .

# Run Python unit tests
python -m unittest discover -s tests -v
```

## Guidelines

1. **Dual Engine Parity**: Features added to the TypeScript engine should also be maintained with equivalent semantics in the Python engine whenever possible.
2. **Zero Telemetry**: Never introduce network dependencies that transmit runtime metadata, analytics, or user telemetry.
3. **High Performance**: Maintain sub-millisecond AST and HTML extraction wherever possible.
4. **Testing**: All pull requests must include unit tests verifying 100% green execution across both runtimes.
5. **Code Style**: Use TypeScript strict mode and standard Python PEP 8 formatting.

## Code of Conduct

All contributors are expected to uphold a respectful, collaborative, and inclusive environment.
Questions or support: contact `contact@nymrel.com`.
