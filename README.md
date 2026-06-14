# pe-sub-docs

Architecture documentation and API specification for the PE Sub Borrowing Base Platform.

## Contents

| File | Description |
|---|---|
| `SOLUTION_DESIGN.md` | Living architecture document — repositories, tech stack, schema, API routes, design decisions |
| `openapi.yaml` | OpenAPI 3.0 specification for `pe-sub-api` (v0.7.1) |
| `openapi-extraction.yaml` | OpenAPI 3.0 specification for `pe-sub-extraction` (port 3002, v0.1.0) |
| `pe-sub-platform.postman_collection.json` | Postman v2.1 collection (both services) — imports into Talend API Tester |
| `PE-Sub-Platform-Solution-Design.docx` | Point-in-time Word export — `SOLUTION_DESIGN.md` is the canonical reference |

## Related repos

| Repo | Description |
|---|---|
| [pe-sub-ui](https://github.com/alexlen01/pe-sub-ui) | React / TypeScript frontend |
| [pe-sub-api](https://github.com/alexlen01/pe-sub-api) | Spring Boot / Java 21 REST API |
| [pe-sub-extraction](https://github.com/alexlen01/pe-sub-extraction) | Spring Boot / Java 21 document extraction service |
| [pe-sub-platform](https://github.com/alexlen01/pe-sub-platform) | Working prototype (requirements reference) |
