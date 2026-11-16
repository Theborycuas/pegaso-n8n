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

const items =
  $input.all().map(i => i.json ?? {});

const meta =
  items[0] ?? {};


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


const filas =
  items.filter(r => r.periodo && r.proveedor);

const periodos =
  ['DIA', 'SEMANA', 'MES'];

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

const cuerpoTexto =
  [
    'Reporte STATUSIA — uso de IAs (cerebro comercial)',
    `Generado: ${generadoAt} (hora Ecuador)`,
    '',
    bloque('DIA'),
    bloque('SEMANA'),
    bloque('MES'),
    '',
    'Notas:',
    '- Un "fallback" cuenta cuando respondió DeepSeek u OpenAI tras fallar Groq (o el anterior).',
    '- tokens≈ usa estimatedTokens del modelo cuando n8n lo expone; si viene vacío, el proveedor no lo devolvió.',
    '- Hasta crear pegaso.ia_llamadas y publicar el logging, las cifras pueden ir en cero.'
  ].join('\n');


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


const htmlEmail =
  `
<p>Reporte <strong>STATUSIA</strong> — cerebro comercial Pegaso</p>
<p>Generado: ${esc(generadoAt)} (hora Ecuador)</p>
${tablaHtml('DIA')}
${tablaHtml('SEMANA')}
${tablaHtml('MES')}
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
        `STATUSIA Pegaso — ${generadoAt}`,

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

      telefono_admin:
        meta.telefono_admin ?? null
    }
  }
];
