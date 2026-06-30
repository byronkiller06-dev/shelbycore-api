# Tenancy (preparado)
El aislamiento multi-tenant se aplica derivando `tenantId` del JWT mediante el
decorador `@CurrentTenant()`. Aquí se incorporará, por fases, el interceptor de
contexto + Row-Level Security (RLS) en PostgreSQL para defensa en profundidad.
