# Nexus Multi-Tenant Data Separation

## Purpose

Nexus must keep each user's data separate by default. Additional users must not be able to see, search, analyse, export or infer another user's archive unless explicit sharing/collaboration permissions are granted.

## Default rule

```text
one user / organisation = one tenant
one source = belongs to exactly one tenant
one graph query = scoped to exactly one tenant unless shared workspace access exists
```

## Minimum production model

```ts
type Tenant = {
  tenant_id: string
  name: string
  plan: 'personal' | 'pro' | 'team' | 'enterprise'
  created_at: string
}

type User = {
  user_id: string
  tenant_id: string
  email: string
  role: 'owner' | 'admin' | 'analyst' | 'viewer'
  created_at: string
}

type Source = {
  source_id: string
  tenant_id: string
  uploaded_by: string
  storage_uri: string
  source_type: string
  created_at: string
}
```

## Database principle

Every table containing customer data must include `tenant_id`.

Required tables:

```text
tenants
users
sources
claims
entities
events
relationships
contradictions
clusters
uploads
audit_log
```

Each row must carry:

```text
tenant_id
created_by / uploaded_by where applicable
created_at
```

## Query rule

Every read/write query must be tenant-scoped:

```sql
SELECT * FROM sources WHERE tenant_id = $1;
```

Never rely only on frontend filtering.

## Storage rule

Cloud Storage paths should be tenant-scoped:

```text
gs://nexus-uploads/<tenant_id>/<source_id>/<filename>
```

Users should never receive raw bucket-wide access.

## Sharing model

Support optional shared workspaces later:

```text
workspace_id
owner_tenant_id
shared_with_user_id
permission: view | comment | analyse | export | admin
```

Sharing must be explicit, logged and revocable.

## Audit log

Every sensitive action should be logged:

- upload;
- delete;
- view source;
- run analysis;
- export report;
- invite user;
- share workspace;
- revoke access.

## Security notes

- Use OAuth/login provider for authentication.
- Do not store user passwords directly.
- Use signed URLs for file access.
- Restrict uploads by size and file type.
- Scan or quarantine suspicious uploads if moving towards public SaaS.
- Use database migrations, not ad hoc schema changes.

## Commercial implication

A single-user private tool can run with basic auth and a single tenant.

A paid product must have tenant isolation before onboarding external users. Without it, customer data exposure risk is unacceptable.
