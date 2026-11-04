/* POST /api/nfce  { qr: "<texto do QR Code da NFC-e>" }
   Busca a página da nota na SEFAZ (pelo servidor — o navegador não pode,
   por causa do CORS) e devolve itens e totais em JSON.
   Só aceita usuário logado no Supabase e só consulta hosts da lista abaixo. */
const { lerNfceBA } = require("./_parse-nfce-ba");

const HOSTS_PERMITIDOS = new Set(["nfe.sefaz.ba.gov.br"]);
const SUPABASE_URL = process.env.SUPABASE_URL || "https://tueevnugbwdlsdzwgvss.supabase.co";
// a anon key é pública por natureza (a mesma do config.js)
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "sb_publishable_QSUtvgXIkIp2A3tgD1Qabg_Qs-xUFrN";
const LIMITE_BYTES = 1500000;

function responder(res, status, corpo) {
  res.setHeader("Cache-Control", "no-store");
  res.status(status).json(corpo);
}

async function usuarioLogado(token) {
  try {
    const r = await fetch(SUPABASE_URL + "/auth/v1/user", {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + token },
    });
    return r.ok;
  } catch (e) { return false; }
}

function urlPermitida(texto) {
  let u;
  try { u = new URL(String(texto || "").trim()); } catch (e) { return null; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  if (!HOSTS_PERMITIDOS.has(u.hostname) || u.port) return null;
  if (!u.pathname.toLowerCase().startsWith("/servicos/nfce/")) return null;
  if (!/^\d{44}(\|[A-Za-z0-9]*)*$/.test(u.searchParams.get("p") || "")) return null;
  return u;
}

function decodificar(buffer, tipo) {
  const charset = (String(tipo || "").match(/charset=([\w-]+)/i) || [])[1];
  if (charset && !/utf-?8/i.test(charset)) return new TextDecoder(charset.toLowerCase() === "iso-8859-1" ? "windows-1252" : charset).decode(buffer);
  try { return new TextDecoder("utf-8", { fatal: true }).decode(buffer); }
  catch (e) { return new TextDecoder("windows-1252").decode(buffer); }
}

async function buscarPagina(url) {
  let atual = url;
  for (let salto = 0; salto < 4; salto++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    try {
      const r = await fetch(atual.toString(), {
        redirect: "manual", signal: ctrl.signal,
        headers: { "User-Agent": "Mozilla/5.0 (compatible; TAFinanceiro/1.0)", Accept: "text/html" },
      });
      if (r.status >= 300 && r.status < 400 && r.headers.get("location")) {
        const prox = new URL(r.headers.get("location"), atual);
        if (!HOSTS_PERMITIDOS.has(prox.hostname)) return { erro: "redirecionamento_bloqueado" };
        atual = prox;
        continue;
      }
      if (!r.ok) return { erro: "sefaz_http_" + r.status };
      const buf = await r.arrayBuffer();
      if (buf.byteLength > LIMITE_BYTES) return { erro: "resposta_grande_demais" };
      return { html: decodificar(buf, r.headers.get("content-type")) };
    } catch (e) {
      return { erro: e && e.name === "AbortError" ? "sefaz_demorou" : "sefaz_inacessivel" };
    } finally { clearTimeout(timer); }
  }
  return { erro: "redirecionamentos_demais" };
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return responder(res, 405, { erro: "metodo_invalido" });
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token || !(await usuarioLogado(token))) return responder(res, 401, { erro: "nao_autorizado" });

  let corpo = req.body;
  if (typeof corpo === "string") { try { corpo = JSON.parse(corpo); } catch (e) { corpo = {}; } }
  const url = urlPermitida(corpo && corpo.qr);
  if (!url) return responder(res, 400, { erro: "emissor_nao_suportado" });

  const pagina = await buscarPagina(url);
  if (pagina.erro) return responder(res, 502, { erro: pagina.erro });

  const nota = lerNfceBA(pagina.html);
  if (!nota.itens.length) return responder(res, 422, { erro: nota.pedeCaptcha ? "captcha" : "itens_nao_encontrados" });
  delete nota.pedeCaptcha;
  return responder(res, 200, nota);
};
