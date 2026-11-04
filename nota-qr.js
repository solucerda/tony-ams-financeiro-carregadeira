/* ═══════════════════════════════════════════════════════
   LEITURA DE NOTA FISCAL PELO QR CODE (NF-e / NFC-e)
   Tudo roda no navegador: lê o QR da foto, pega a chave de acesso de 44
   dígitos e dela tira CNPJ do emitente (o posto), modelo, série, número e
   mês/ano. Funções puras no topo (testáveis fora do navegador).
   ═══════════════════════════════════════════════════════ */
(function (raiz) {
  // dígito verificador da chave (módulo 11, pesos 2..9 da direita p/ esquerda)
  function dvChave(chave43) {
    let soma = 0, peso = 2;
    for (let i = chave43.length - 1; i >= 0; i--) {
      soma += Number(chave43[i]) * peso;
      peso = peso === 9 ? 2 : peso + 1;
    }
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  }

  // o QR da NFC-e é uma URL (…?p=CHAVE|2|1|1|hash ou …chNFe=CHAVE); o da
  // NF-e/DANFE traz só a chave. Em todos os casos, são 44 dígitos seguidos.
  function extrairChave(texto) {
    const t = String(texto || "");
    const exato = t.match(/(?<!\d)\d{44}(?!\d)/);
    if (exato) return exato[0];
    const colado = t.replace(/[\s.]+/g, "").match(/(?<!\d)\d{44}(?!\d)/);
    return colado ? colado[0] : null;
  }

  function cnpjValido(cnpj) {
    if (!/^\d{14}$/.test(cnpj) || /^(\d)\1{13}$/.test(cnpj)) return false;
    const calc = (base) => {
      let soma = 0, peso = base.length - 7;
      for (const d of base) { soma += Number(d) * peso; peso = peso === 2 ? 9 : peso - 1; }
      const r = soma % 11;
      return r < 2 ? 0 : 11 - r;
    };
    const d1 = calc(cnpj.slice(0, 12));
    const d2 = calc(cnpj.slice(0, 12) + d1);
    return cnpj.endsWith(String(d1) + String(d2));
  }

  function formatarCnpj(c) {
    return c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  }

  function interpretarChave(chave) {
    if (!/^\d{44}$/.test(chave || "")) return null;
    const modelo = chave.slice(20, 22);
    const cnpj = chave.slice(6, 20);
    return {
      chave,
      chaveConfere: dvChave(chave.slice(0, 43)) === Number(chave[43]),
      uf: chave.slice(0, 2),
      ano: 2000 + Number(chave.slice(2, 4)),
      mes: Number(chave.slice(4, 6)),
      cnpj,
      cnpjConfere: cnpjValido(cnpj),
      modelo,
      tipo: modelo === "65" ? "NFC-e" : modelo === "55" ? "NF-e" : "Nota fiscal",
      serie: Number(chave.slice(22, 25)),
      numero: Number(chave.slice(25, 34)),
    };
  }

  // imageData = { data: Uint8ClampedArray RGBA, width, height }
  function decodificarQrDeImageData(imageData) {
    if (typeof raiz.jsQR !== "function") return null;
    const r = raiz.jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "attemptBoth" });
    return r && r.data ? r.data : null;
  }

  // ── só no navegador ──────────────────────────────────────────────
  async function abrirBitmap(arquivo) {
    if (typeof raiz.createImageBitmap === "function") {
      try { return await raiz.createImageBitmap(arquivo); } catch (e) { /* cai no <img> */ }
    }
    const url = URL.createObjectURL(arquivo);
    try {
      return await new Promise((ok, erro) => {
        const img = new Image();
        img.onload = () => ok(img);
        img.onerror = () => erro(new Error("imagem inválida"));
        img.src = url;
      });
    } finally { URL.revokeObjectURL(url); }
  }

  // Foto de WhatsApp costuma ser pequena/torta: tenta o leitor nativo do
  // navegador (quando existe) e depois o jsQR em vários tamanhos.
  async function lerQrDeArquivo(arquivo) {
    const img = await abrirBitmap(arquivo);
    const largura = img.width, altura = img.height;

    if ("BarcodeDetector" in raiz) {
      try {
        const det = new raiz.BarcodeDetector({ formats: ["qr_code"] });
        const achados = await det.detect(img);
        if (achados.length && achados[0].rawValue) return achados[0].rawValue;
      } catch (e) { /* segue pro jsQR */ }
    }

    const maior = Math.max(largura, altura);
    const alvos = [1600, 1000, 2400, 700];
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    for (const alvo of alvos) {
      const escala = alvo / maior;
      if (escala > 3) continue; // não amplia foto minúscula além do razoável
      canvas.width = Math.max(1, Math.round(largura * escala));
      canvas.height = Math.max(1, Math.round(altura * escala));
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const texto = decodificarQrDeImageData(ctx.getImageData(0, 0, canvas.width, canvas.height));
      if (texto) return texto;
    }
    return null;
  }

  const api = { dvChave, extrairChave, cnpjValido, formatarCnpj, interpretarChave, decodificarQrDeImageData, lerQrDeArquivo };
  raiz.NotaQR = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
