/* Leitor da página "Consulta DANFE NFC-e" da SEFAZ-BA (visão sintética).
   Recebe o HTML e devolve os dados da nota. Arquivo com "_" no começo não
   vira endpoint na Vercel — é só biblioteca da função /api/nfce. */

function decodificar(s) {
  return String(s)
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"').replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}
function limpar(s) {
  return decodificar(String(s == null ? "" : s).replace(/<[^>]+>/g, " ")).replace(/[\s\u00a0]+/g, " ").trim();
}
// "2.719,50" -> 2719.5
function numero(s) {
  const t = String(s == null ? "" : s).replace(/[^\d,.-]/g, "");
  if (!t) return null;
  const n = Number(t.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
function pegar(bloco, re) {
  const m = bloco.match(re);
  return m ? m[1] : "";
}
function totalPorRotulo(html, rotulo) {
  const re = new RegExp("<label[^>]*>\\s*" + rotulo + "\\s*</label>\\s*<span[^>]*>([\\d.,]+)</span>", "i");
  return numero(pegar(html, re));
}

function lerNfceBA(html) {
  const itens = [];
  const reItem = /<tr[^>]*id="Item[^"]*"[^>]*>([\s\S]*?)<\/tr>/gi;
  let m;
  while ((m = reItem.exec(html))) {
    const b = m[1];
    const item = {
      descricao: limpar(pegar(b, /class="txtTit"[^>]*>([\s\S]*?)<\/span>/i)),
      codigo: limpar(pegar(b, /class="RCod"[^>]*>([\s\S]*?)<\/span>/i)).replace(/^\(?\s*C.digo:\s*/i, "").replace(/\)\s*$/, ""),
      quantidade: numero(pegar(b, /class="Rqtd"[^>]*>[\s\S]*?<\/strong>\s*([\d.,]+)/i)),
      unidade: limpar(pegar(b, /class="RUN"[^>]*>[\s\S]*?<\/strong>\s*([^<]+)/i)),
      valorUnit: numero(pegar(b, /class="RvlUnit"[^>]*>[\s\S]*?<\/strong>(?:&nbsp;|[\s\u00a0])*([\d.,]+)/i)),
      valorTotal: numero(pegar(b, /class="valor"[^>]*>\s*([\d.,]+)/i)),
    };
    if (item.descricao) itens.push(item);
  }

  const emissao = html.match(/Emiss[^:<]{0,4}:\s*<\/strong>\s*(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}:\d{2})/i);
  const forma = html.match(/<label[^>]*class="tx"[^>]*>([\s\S]*?)<\/label>\s*<span[^>]*>([\d.,]+)<\/span>/i);
  const cnpjEmitente = html.match(/id="u20"[\s\S]*?CNPJ:\s*([\d./-]+)/i);

  return {
    emitente: {
      nome: limpar(pegar(html, /id="u20"[^>]*>([\s\S]*?)<\/div>/i)),
      cnpj: cnpjEmitente ? cnpjEmitente[1].replace(/\D/g, "") : "",
    },
    data: emissao ? `${emissao[3]}-${emissao[2]}-${emissao[1]}` : null,
    hora: emissao ? emissao[4] : null,
    itens,
    total: totalPorRotulo(html, "Valor total R\\$:"),
    desconto: totalPorRotulo(html, "Descontos? R\\$:") || 0,
    aPagar: totalPorRotulo(html, "Valor a pagar R\\$:"),
    forma: forma ? { descricao: limpar(forma[1]), valor: numero(forma[2]) } : null,
    pedeCaptcha: /captcha/i.test(html),
  };
}

module.exports = { lerNfceBA };
