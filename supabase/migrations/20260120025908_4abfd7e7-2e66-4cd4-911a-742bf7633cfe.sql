-- Revogar acesso da API à materialized view (ela é usada apenas internamente via RPC)
REVOKE ALL ON mv_dashboard_metricas_diarias FROM anon, authenticated;

-- Garantir que apenas a função RPC pode acessar
GRANT SELECT ON mv_dashboard_metricas_diarias TO postgres;