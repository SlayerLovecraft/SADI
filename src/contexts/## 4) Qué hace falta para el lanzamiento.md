## 4) Qué hace falta para el lanzamiento comercial (pendientes)
### 4.1 Pendientes críticos (bloquean salida a producción/venta)
- Envío real de mensajes (SMS/WhatsApp/email) :
  - El frontend ya llama supabase.functions.invoke('send-sms', { campaignId }) , pero la función está sin implementar.
  - Definir proveedor (Twilio/Infobip/Sinch/MessageBird/operador local) y asegurar:
    - Plantillas, opt‑in/opt‑out, trazabilidad, reintentos, colas, rate limits.
    - Registro por mensaje (estado: enviado/entregado/fallido) y actualización de contadores en campaigns .
- Creación segura de pacientes (Edge Function create-patient ) :
  - La UI está lista y espera que el backend:
    - Cree el paciente (y/o usuario asociado), genere contraseña temporal , envíe correo/SMS de activación y aplique políticas.
  - Hoy la Function no hace nada de eso; debe implementarse antes de vender el producto.
- Seguridad de credenciales :
  - En SQL/flujo doctor hay contraseña en texto plano (y en algunos flujos paciente hay lógica provisional).
  - Necesario: hashing fuerte (bcrypt/argon2), políticas de cambio, bloqueo por intentos, recuperación segura.
- RLS y multitenencia (para vender a múltiples IPS/EPS):
  - Asegurar que cada hospital solo vea sus datos ( hospital_id ) sin filtrado “solo frontend”.
  - Consolidar políticas RLS, usar RPCs SECURITY DEFINER solo cuando corresponda y con validaciones.
- Despliegue reproducible :
  - Corregir pipeline de build (Dockerfile), variables de entorno, y formalizar ambientes: dev/staging/prod.
  - Revisar manejo de .env (no debe quedar expuesto en builds/repositorios).
### 4.2 Pendientes importantes (no bloquean demo, sí bloquean “venta seria”)
- Auditoría y trazabilidad (requisito típico en salud):
  - Log de accesos, acciones críticas (creación/edición/borrado), envíos de mensajes, cambios de segmento, exportaciones.
- Cumplimiento y legal (Colombia):
  - Habeas Data / Ley 1581 (consentimiento y finalidades), seguridad de datos sensibles en salud, retención, derechos del titular.
  - Documentos comerciales: contrato, DPA/encargo de tratamiento, política de privacidad, términos, SLA.
- Integración con HIS (p.ej. SIHOS) :
  - Diseñar un backend integrador (API) dentro de la red del hospital para sincronizar pacientes, citas, programas, eventos clínicos.
  - Definir mapeos y eventos: creación/actualización de pacientes, agenda/citas, campañas por programa, resultados/recordatorios.
- Operación y soporte :
  - Panel de configuración por hospital (remitente SMS, horarios, firmas, plantillas, umbrales).
  - Manuales de operación, capacitación, soporte N1/N2, monitoreo (alertas de fallas en envíos).
- QA/Pruebas :
  - Pruebas funcionales por rol, pruebas de carga para campañas masivas, pruebas de seguridad (OWASP), pruebas de RLS.
## 5) Riesgos actuales y mitigación
- Riesgo: fuga de datos entre hospitales si el control se hace “solo en frontend”.
  - Mitigación: RLS + pruebas de aislamiento + auditoría.
- Riesgo: envío masivo sin control (costos / reputación / legal) .
  - Mitigación: opt‑in, límites por hora, listas de exclusión, plantillas aprobadas, bitácora.
- Riesgo: despliegue no reproducible (Dockerfile inconsistente).
  - Mitigación: corregir build + CI/CD básico + staging.
- Riesgo: contraseñas y autenticación débiles .
  - Mitigación: hashing, políticas, recuperación segura, MFA para admins si aplica.
## 6) Plan de acción propuesto (para “salir a venta”)
Semana 1 (cierre técnico mínimo vendible / MVP comercial):

- Implementar create-patient (alta de paciente + credenciales temporales + notificación).
- Implementar send-sms (envío real + registro por mensaje + actualización campañas).
- Corregir despliegue (Dockerfile Vite + variables de entorno + staging).
Semana 2–3 (robustez y compliance):

- Hashing de contraseñas (doctores/pacientes), recuperación y políticas.
- RLS multi‑tenant (pacientes/campañas/plantillas/segmentos/interacciones/signos vitales).
- Auditoría mínima (tabla de logs + captura de acciones críticas).
Semana 4+ (venta a EPS/IPS con integración):

- Backend integrador HIS (SIHOS u otros) con conectores + mapeos.
- Tablero de administración por hospital (configuración de mensajería, consentimientos, plantillas).
- Documentación comercial y técnica (SLA, DPA, políticas, seguridad).
## 7) Recomendación de arquitectura para vender a hospitales/EPS/IPS (integración SIHOS)
- Mantener el frontend como está, pero no conectar directo a la BD SIHOS .
- Implementar una capa: SADI Web -> API SADI (backend) -> (Supabase + Conector SIHOS) :
  - El conector SIHOS puede ser por API/HL7/archivos/tablas puente según lo que el hospital/proveedor permita.
  - Esto permite: seguridad, auditoría, colas de mensajería, y desacoplar el core del HIS.