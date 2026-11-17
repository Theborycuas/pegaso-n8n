// ======================================================
// N8N NODE - PEGASO
// ======================================================
// Nombre: Preparar reporte STATUSIA
// Node ID: b23a9e01-7c01-457f-8421-84c6d6afa1b9
// TypeVersion: 2
//
// Workflow:
// SISTEMA AUTOMATIZADO PEGASO
//
// Workflow ID:
// 09OF22FOxihypeeh
//
// NOTA:
// Archivo generado automáticamente desde n8n.
// El header NO pertenece al código almacenado en n8n.
// ======================================================

const registros =
  $input.all().map(i => i.json ?? {});


function num(valor) {
  const n =
    Number(valor ?? 0);

  return Number.isFinite(n) ? n : 0;
}


function esc(valor) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}


function comoArray(valor) {
  if (Array.isArray(valor)) {
    return valor;
  }

  if (valor && typeof valor === 'object') {
    return [valor];
  }

  if (typeof valor === 'string') {
    const t =
      valor.trim();

    if (!t) {
      return [];
    }

    try {
      const parsed =
        JSON.parse(t);

      return Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === 'object'
          ? [parsed]
          : [];
    } catch (_) {
      return [];
    }
  }

  return [];
}


function extraerErrorDb(filas) {
  for (const row of filas) {
    const msg =
      row?.message ||
      row?.error?.message ||
      row?.error?.description ||
      (
        typeof row?.error === 'string'
          ? row.error
          : null
      );

    if (msg) {
      return String(msg);
    }
  }

  return null;
}


const errorDb =
  extraerErrorDb(registros);

const items = [];
let preventa = {};

for (const item of registros) {
  if (item?.tipo_registro === 'IA') {
    items.push(...comoArray(item.datos));
    continue;
  }

  if (item?.tipo_registro === 'PREVENTA') {
    const datos =
      comoArray(item.datos)[0] ?? item.datos;

    if (datos && typeof datos === 'object' && !Array.isArray(datos)) {
      preventa =
        datos;
    }

    continue;
  }

  if (item?.periodo && item?.proveedor) {
    items.push(item);
  }
}

const filas =
  items.filter(r => r && r.periodo && r.proveedor);

const hayPreventa =
  Object.keys(preventa).length > 0;


function bloque(periodo) {
  const delPeriodo =
    filas.filter(r => String(r.periodo).toUpperCase() === periodo);

  if (delPeriodo.length === 0) {
    return `${periodo}: sin registros todavía.\n`;
  }

  const lineas =
    delPeriodo.map(r => {
      const ok =
        num(r.exitos);

      const fail =
        num(r.fallos);

      const total =
        ok + fail;

      const fb =
        num(r.fallbacks);

      const tok =
        num(r.tokens_estimados_suma);

      return (
        `  ${r.proveedor}: ${total} intentos` +
        ` (ok ${ok}, fallos ${fail}, fallback ${fb})` +
        (tok > 0 ? `, tokens≈${tok}` : '')
      );
    });

  return `${periodo}:\n${lineas.join('\n')}\n`;
}


const generadoAt =
  new Date().toLocaleString('es-EC', {
    timeZone: 'America/Guayaquil'
  });

const avisoTabla =
  errorDb &&
  /ia_llamadas|does not exist|no existe/i.test(errorDb)
    ? (
        'BLOQUEANTE: no existe la tabla pegaso.ia_llamadas. ' +
        'Ejecute en Postgres el archivo schema/ia_llamadas.sql ' +
        '(o el nodo manual \"Execute a SQL query\" con ese DDL). ' +
        'Hasta entonces el logging no guarda nada y STATUSIA saldrá vacío.'
      )
    : errorDb
      ? `Error al consultar uso de IA: ${errorDb}`
      : filas.length === 0
        ? (
            'La consulta corrió bien pero no hay filas en pegaso.ia_llamadas ' +
            'para el período. Tras crear la tabla, espere conversaciones ' +
            'reales (cerebro Groq/DeepSeek/OpenAI) y vuelva a enviar STATUSIA.'
          )
        : null;


function tablaHtml(periodo) {
  const delPeriodo =
    filas.filter(r => String(r.periodo).toUpperCase() === periodo);

  if (delPeriodo.length === 0) {
    return `<p><strong>${periodo}</strong>: sin registros.</p>`;
  }

  const rows =
    delPeriodo.map(r => `
  <tr>
    <td>${esc(r.proveedor)}</td>
    <td>${num(r.exitos) + num(r.fallos)}</td>
    <td>${num(r.exitos)}</td>
    <td>${num(r.fallos)}</td>
    <td>${num(r.fallbacks)}</td>
    <td>${num(r.tokens_estimados_suma) || '—'}</td>
  </tr>`).join('');

  return `
<h3>${periodo}</h3>
<table cellpadding="6" cellspacing="0" border="1" style="border-collapse:collapse;">
  <tr>
    <th>Proveedor</th>
    <th>Intentos</th>
    <th>OK</th>
    <th>Fallos</th>
    <th>Fallback</th>
    <th>Tokens≈</th>
  </tr>
  ${rows}
</table>`;
}


const bloqueAvisoHtml =
  avisoTabla
    ? `<p style="background:#fff3cd;border:1px solid #ffc107;padding:12px;"><strong>Diagnóstico:</strong> ${esc(avisoTabla)}</p>`
    : '';

const bloquePreventaHtml =
  hayPreventa
    ? `
<h3>PREVENTA — hoy</h3>
<p>
Turnos: ${num(preventa.turnos)} ·
FAQ cacheada: ${num(preventa.cache_faq)} ·
Llamadas evitadas: ${num(preventa.llamadas_evitadas)} ·
Cierres: ${num(preventa.cierres)}
</p>`
    : '';

const cuerpoTexto =
  [
    'Reporte STATUSIA — uso de IAs (cerebro comercial)',
    `Generado: ${generadoAt} (hora Ecuador)`,
    '',
    avisoTabla ? `DIAGNÓSTICO: ${avisoTabla}` : null,
    avisoTabla ? '' : null,
    bloque('DIA'),
    bloque('SEMANA'),
    bloque('MES'),
    '',
    hayPreventa
      ? 'PREVENTA — hoy (Ecuador)'
      : null,
    hayPreventa
      ? `Turnos: ${num(preventa.turnos)}; FAQ cacheada: ${num(preventa.cache_faq)}; llamadas evitadas: ${num(preventa.llamadas_evitadas)}.`
      : null,
    '',
    'Notas:',
    '- Fallback = DeepSeek/OpenAI tras fallar el anterior.',
    '- tokens≈ solo si el Chat Model expuso estimatedTokens/usage.',
    '- Requiere tabla pegaso.ia_llamadas (schema/ia_llamadas.sql).'
  ]
    .filter(x => x !== null)
    .join('\n');

const htmlEmail =
  `
<p>Reporte <strong>STATUSIA</strong> — cerebro comercial Pegaso</p>
<p>Generado: ${esc(generadoAt)} (hora Ecuador)</p>
${bloqueAvisoHtml}
${tablaHtml('DIA')}
${tablaHtml('SEMANA')}
${tablaHtml('MES')}
${bloquePreventaHtml}
<p style="color:#666;font-size:12px;">
Fallback = DeepSeek/OpenAI/NINGUNO tras fallo del anterior.
Tokens solo si el Chat Model expuso estimatedTokens/usage.
</p>
`;


return [
  {
    json: {
      comando_bot:
        'STATUSIA',

      notificacion_interna:
        true,

      categoria_notificacion:
        'STATUSIA',

      prioridad_notificacion:
        'MEDIA',

      asunto_notificacion:
        errorDb
          ? `STATUSIA Pegaso — ERROR · ${generadoAt}`
          : `STATUSIA Pegaso — ${generadoAt}`,

      mensaje_notificacion:
        cuerpoTexto,

      html_notificacion:
        htmlEmail,

      canal_notificacion:
        'EMAIL',

      enviar_notificacion:
        true,

      notificacion_preparada_at:
        new Date().toISOString(),

      filas_reporte:
        filas.length,

      error_db:
        errorDb,

      diagnostico:
        avisoTabla
    }
  }
];
