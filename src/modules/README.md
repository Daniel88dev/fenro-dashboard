# Modules

One folder per bounded context. A context owns its domain, its use cases and
its adapters, and exposes the rest of the app nothing but commands, queries and
UI components.

```
<context>/
├── domain/                   entities, value objects, domain events, repository ports
├── application/
│   ├── commands/             write use cases: <verb>-<noun>.command.ts + .handler.ts
│   ├── queries/              read use cases: <verb>-<noun>.query.ts + .handler.ts
│   └── ports/                outbound interfaces this context needs
├── infrastructure/           adapters implementing those ports
└── ui/                       React components for this context
```

Contexts do not import each other's internals. If two contexts need to talk,
they do it through a command, a query, or a domain event.

The shared building blocks — `Entity`, `AggregateRoot`, `ValueObject`,
`Result`, `UniqueId`, the command and query contracts and the in-memory buses —
live in `src/shared/`. See [CLAUDE.md](../../CLAUDE.md) for the conventions.
