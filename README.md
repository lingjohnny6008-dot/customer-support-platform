# Support Chat Platform Authentication

This repository contains the authentication-only implementation for SCP.

## Scope

- Customer login with `phone + password`
- Agent login with `username/email + password`
- Admin login with `username/email + password`
- Logout
- Signed HTTP-only session cookie
- Route guard for `/dashboard`
- Role permission checks
- Supabase RPC password hash verification

Chat, profile cards, and image upload are intentionally not implemented.

## Routes

- `/login/customer`
- `/login/agent`
- `/dashboard`
- `/admin/customers`
- `/chat`
- `/dashboard/conversations`

Admin login is available from `/login/agent` by selecting the Admin role.

`/admin/customers` is restricted to sessions with `role = admin`.
`/chat` is restricted to customer sessions.
`/dashboard/conversations` is restricted to agent and admin sessions.

## Environment

Copy `.env.example` to `.env.local` and configure:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SESSION_SECRET=replace-with-at-least-32-random-characters
```

`SUPABASE_SERVICE_ROLE_KEY` is used only on the server to call authentication RPC functions.

## Supabase Migration

Run:

```bash
supabase/migrations/202606090326_auth_system.sql
```

The migration adds staff authentication fields to `agents` and creates:

- `verify_customer_login(input_phone, input_password)`
- `verify_staff_login(input_identifier, input_password, expected_role)`

Run the customer management migration:

```bash
supabase/migrations/202606090337_customer_management.sql
```

It creates admin-only RPCs for customer creation, customer updates, and password resets:

- `create_customer_admin(...)`
- `update_customer_admin(...)`
- `reset_customer_password_admin(...)`

Run the conversation MVP migration:

```bash
supabase/migrations/202606090353_conversation_mvp.sql
```

It creates a trigger that updates `conversations.last_message_at` whenever a
message is inserted and registers `conversations` / `messages` for Supabase
Realtime.

## Password Hashes

Password hashes should be generated with PostgreSQL `pgcrypto`:

```sql
update customers
set password_hash = crypt('plain-password', gen_salt('bf'))
where phone = '+60123456789';

update agents
set password_hash = crypt('plain-password', gen_salt('bf'))
where email = 'agent@example.com';
```
