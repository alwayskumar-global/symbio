# Symbio

**One-line pitch:** Can Kalundborg recover gas from fermentation residues and still deliver the nutrients its farmers rely on?

**Project description:** In Kalundborg, fermentation residues were already going to farmers before local biogas production began. Symbio asks what a planner could do with those streams while honoring the existing agricultural service. Its embedded Relate graph connects two suppliers to their residues, the processes that accept them, and the destinations that can receive both biomethane and digestate. A route qualifies for evaluation only when both products have somewhere to go.

The agreement matters as much as the equipment. With direct farm deliveries protected, the model retains the baseline. With an assumed amendment allowing equivalent nitrogen delivery through digestate, the largest candidate delivers 772.91 MWh of biomethane in a modeled year. Remove the yeast supplier, and two different plant sizes tie at 306.88 MWh. These are conditional scenario results, not measured plant performance or an assertion of authorization.

**How to inspect it:** Open the checked-in single-file Relate store at `dist/kalundborg-seed.rl` or use the README to run the local app. Explore a supplier path, compare the two agreements, remove a supplier, then follow a saved plan to the evidence behind it.

**Built with:** Relate, Cypher, Python, OR-Tools GLOP, FastAPI, React and TypeScript.

**Repository:** https://github.com/alwayskumar-global/symbio

**AI use:** AI assisted research, implementation, testing and documentation. Route discovery uses Cypher; allocation uses a linear solver. The application runs locally without an AI service.
