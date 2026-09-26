# StockSense Documentation

These pages cover the StockSense inventory management system built for the Odoo × GCET hackathon. Start with the main [README](../README.md) for an overview and local setup.

| Document | What it covers |
| --- | --- |
| [REQUIREMENTS.md](REQUIREMENTS.md) | The problem statement, target users, and a traceability matrix from each requirement to the code |
| [SYSTEM_DESIGN.md](SYSTEM_DESIGN.md) | Architecture, components, auth, the operation state machine, stock flows, locking, events and configuration |
| [DATABASE.md](DATABASE.md) | Full ER diagram, every table and constraint, integrity guarantees, migrations and useful SQL |
| [API.md](API.md) | Every endpoint with access rules, request bodies, filters and errors |
| [TECHNICAL_DECISIONS.md](TECHNICAL_DECISIONS.md) | Architecture decision records: why each design choice was made and what it costs |
| [TESTING.md](TESTING.md) | Test strategy, test inventory, current results, CI and a manual end-to-end checklist |
| [DEMO_GUIDE.md](DEMO_GUIDE.md) | Seed data, demo accounts and a timed demo script |

## Reference material from Odoo

- [Problem statement (PDF)](StockSense.pdf)
- [Excalidraw board](https://app.excalidraw.com/l/65VNwvy7c4X/3ENvQFu9o8R)
- [Local Excalidraw source](StockSense%20-%208%20hours.excalidraw) and [PNG export](StockSense%20-%208%20hours.png)

## Reading order

1. **New to the project:** README → REQUIREMENTS → DEMO_GUIDE
2. **Working on the backend:** SYSTEM_DESIGN → DATABASE → API → TESTING
3. **Reviewing the design:** TECHNICAL_DECISIONS → SYSTEM_DESIGN (Known limitations)
