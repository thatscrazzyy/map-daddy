# Security Policy

## Supported Versions

Map Daddy is pre-1.0. Security fixes are applied to the `main` branch.

## Reporting A Vulnerability

Please do not open a public issue for a vulnerability.

Report privately by contacting the repository owner through GitHub. Include:

- Affected component.
- Steps to reproduce.
- Expected impact.
- Any suggested fix.

## Sensitive Data

Do not commit:

- `.env` or `.env.local` files.
- API tokens or service credentials.
- Cloudflare account IDs, API tokens, tunnel credentials, KV namespace IDs, or private R2 bucket names.
- Private keys or certificates.
- Uploaded media from `backend/media/`.
- Project runtime data from `backend/projects/`.
- Local logs or tunnel logs.

Treat uploaded media URLs as public unless your deployment adds authentication.
