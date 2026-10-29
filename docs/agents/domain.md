# Domain docs

## Reading

- Read the root [GLOSSARY.md](../../GLOSSARY.md) for domain terms and their meanings. This repo uses a single glossary.
- When changing domain behavior, read the relevant section of [Domain rules](../domain-rules.md) and the ADRs it references.
- Read relevant decisions in `docs/adr/`, including any superseding decisions. Flag a conflict before proposing a change that would reverse an ADR.

## Maintaining

Keep glossary definitions to one or two sentences describing what a domain concept is, with rejected synonyms under `_Avoid_`. Group related terms under headings.

Put behavior rules and implementation details in the relevant feature documentation, starting with `docs/domain-rules.md`. Keep plans, acceptance criteria, and unfinished work in the project's specs or tickets.

Offer an ADR only for a decision that is hard to reverse, surprising without context, and the result of a real trade-off. Record the choice and why; preserve historical decisions and mark them when superseded.

Create documentation when there is something to record. Existing domain terms and decisions remain the source of truth; resolve contradictions with the code or the user before changing their meaning.
