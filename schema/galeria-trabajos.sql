-- Galería de trabajos realizados (docs/reportes/2026-11-17-galeria-trabajos.md).
-- Idempotente: vuelve a ejecutarse para cambiar fotos o palabras.
-- AGUA es la predeterminada cuando el prospecto no nombra un producto conocido.
-- Para apagarla: "activo": false.

-- Las filas antiguas se insertaron con id explícito y la secuencia quedó
-- atrás (error "configuracion_bot_pkey ... Key (id)=(N) already exists").
-- Se alinea con el id máximo antes de insertar.
SELECT setval(
  pg_get_serial_sequence('pegaso.configuracion_bot', 'id'),
  COALESCE((SELECT max(id) FROM pegaso.configuracion_bot), 0) + 1,
  false
);

INSERT INTO pegaso.configuracion_bot (clave, valor_json, actualizado_at)
VALUES (
  'GALERIA_TRABAJOS',
  '{
    "activo": true,
    "texto_cierre": "Le adjunto varios de nuestros trabajos.",
    "galerias": [
      {
        "clave": "LACTEOS",
        "palabras": ["leche", "lacteo", "yogurt", "yogur", "yogourt", "queso", "kumis", "kefir", "mantequilla", "manjar"],
        "medios": [
          "https://pegasoadhesivos.com/wp-content/uploads/2026/11/imagen_2026-11-17_102358615.png",
          "https://pegasoadhesivos.com/wp-content/uploads/2026/11/Video-Lacteos-5.mp4",
          "https://pegasoadhesivos.com/wp-content/uploads/2026/11/Video-Lacteos-6.mp4",
          "https://pegasoadhesivos.com/wp-content/uploads/2026/11/Video-Lacteos-4.mp4",
          "https://pegasoadhesivos.com/wp-content/uploads/2026/11/Video-Lacteos-3.mp4",
          "https://pegasoadhesivos.com/wp-content/uploads/2026/11/Video-Lacteos-2.mp4",
          "https://pegasoadhesivos.com/wp-content/uploads/2026/11/Video-Lacteos-1.mp4"
        ]
      },
      {
        "clave": "AGUA",
        "predeterminada": true,
        "palabras": ["agua", "botella", "botellon", "bidon", "galon", "purificada", "alcalina"],
        "medios": [
          "https://pegasoadhesivos.com/wp-content/uploads/2026/11/imagen_2026-11-17_101948314.png",
          "https://pegasoadhesivos.com/wp-content/uploads/2026/11/WhatsApp-Video-2026-10-20-at-21.30.03-1.mp4",
          "https://pegasoadhesivos.com/wp-content/uploads/2026/11/imagen_2026-11-17_101957029.png",
          "https://pegasoadhesivos.com/wp-content/uploads/2026/11/imagen_2026-11-17_102008291.png",
          "https://pegasoadhesivos.com/wp-content/uploads/2026/11/imagen_2026-11-17_102014000.png",
          "https://pegasoadhesivos.com/wp-content/uploads/2026/11/imagen_2026-11-17_102019113.png",
          "https://pegasoadhesivos.com/wp-content/uploads/2026/11/imagen_2026-11-17_102023692.png",
          "https://pegasoadhesivos.com/wp-content/uploads/2026/11/imagen_2026-11-17_102028750.png",
          "https://pegasoadhesivos.com/wp-content/uploads/2026/11/imagen_2026-11-17_102033722.png",
          "https://pegasoadhesivos.com/wp-content/uploads/2026/11/imagen_2026-11-17_102039140.png",
          "https://pegasoadhesivos.com/wp-content/uploads/2026/11/imagen_2026-11-17_102044673.png",
          "https://pegasoadhesivos.com/wp-content/uploads/2026/11/imagen_2026-11-17_102049197.png",
          "https://pegasoadhesivos.com/wp-content/uploads/2026/11/imagen_2026-11-17_102054790.png"
        ]
      }
    ]
  }'::jsonb,
  NOW()
)
ON CONFLICT (clave) DO UPDATE
SET valor_json = EXCLUDED.valor_json,
    actualizado_at = NOW();
