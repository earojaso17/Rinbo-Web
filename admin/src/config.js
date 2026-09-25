// Configuración de RINBŌ Admin. La llave "publishable" es pública por diseño (va dentro de la app);
// lo que protege los datos son las reglas RLS de la base (solo administradores) y Cloudflare Access.
export const SUPABASE_URL = "https://mgxljvxjonopchpvmjkl.supabase.co";
export const SUPABASE_LLAVE_PUBLICA = "sb_publishable_KwzdkIFMqA9ewv9Kg321iw_S6MnaRnd";
export const SITIO = "https://rinbo.store";
// Planilla antigua (CSV publicado de la pestaña Catálogo): solo para importar productos desde ella
export const PLANILLA_CSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRkxRbV34pHdMGFF99GL125xelh2PdbdmX_JF_mtIkKgU45xsVYf3C1620CiQrwqSBljbbiYWbkfqLK/pub?gid=344349355&single=true&output=csv";
// Pestaña SegPublica (pedidos antiguos): solo para importarlos una vez a la Admin
export const SEGUIMIENTO_CSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRkxRbV34pHdMGFF99GL125xelh2PdbdmX_JF_mtIkKgU45xsVYf3C1620CiQrwqSBljbbiYWbkfqLK/pub?gid=308139092&single=true&output=csv";
