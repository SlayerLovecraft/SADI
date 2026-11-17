# Guía de Instalación: Detector Pre-Answer SIP 183 (Asterisk + OpenVox GSM 32P)

Esta capa impide que el carrier (Claro, Movistar, Tigo o WOM) inicie cobro por desvío a buzón de voz al analizar la señal **antes del `SIP 200 OK`** directamente entre el Gateway GSM OpenVox y Vapi.

## Cómo evita el cobro del carrier
1. **Análisis RTP en `SIP 183` (Early Media)**: OpenVox transmite los mensajes del operador (*"su llamada está siendo transferida al correo de voz"*, *"el usuario no está disponible"* o tono de buzón) como Early Media RTP **antes de enviar `200 OK`**. `early_media_detector.py` inspecciona paquetes PCMU (`ulaw`) cada 20 ms mediante ARI `ExternalMedia` sin ejecutar `Answer()`. Si detecta locución continua (>= 1.65 s) o tono de buzón (`>= 320 ms` en `480/950/1000/1400 Hz`), cancela vía `DELETE /channels/{id}` emitiendo **`SIP CANCEL` con `$0 COP` de cobro**.
2. **Corte preventivo previo al salto de buzón (`RING_MAX = 19s`)**: Si el celular del paciente simplemente sigue timbrando sin contestar (`180 Ringing`), en operadores colombianos el desvío automático al buzón ocurre entre los `20s` y `25s`. Cortar a los `19s` aborta la llamada antes del `200 OK` del buzón.
3. **Capa 2 de respaldo (Vapi `voicemailDetection` + Corte inmediato)**: Si algún operador envía `200 OK` inmediato al abrir la casilla de voz, la Edge Function `vapi-outbound-call` activa `voicemailDetection` nativo (`voicemailMessage: ""`) y `vapi-webhook` corta la sesión y marca **`facturable_ips = false` (`$0 COP`)**.

## Pasos de despliegue en servidor Asterisk
1. Copie `pjsip_openvox_vapi.conf` a `/etc/asterisk/pjsip_custom.conf` e inclúyalo en `/etc/asterisk/pjsip.conf`, configurando `OPENVOX_GATEWAY_HOST`.
2. Copie `extensions_anti_voicemail.conf` a `/etc/asterisk/extensions_custom.conf` e inclúyalo en `/etc/asterisk/extensions.conf`.
3. En la interfaz web de **OpenVox GSM Gateway**:
   - SIP Trunk -> habilite *Early Media (`183 Session Progress`)* y *Progress Inband*.
   - Codec preferido: `G.711 u-law` (`ulaw`).
4. Ejecute `early_media_detector.py` (Python 3.10+, cero dependencias externas requeridas) junto con Asterisk ARI habilitado en `/etc/asterisk/ari.conf` (`enabled = yes`) y configure en los secretos de Supabase Edge Functions:
   - `ASTERISK_ARI_URL=http://<TU_SERVIDOR_ASTERISK>:8090`
   - `ASTERISK_BRIDGE_SECRET=<secreto_compartido>`
   - `VAPI_WEBHOOK_SECRET=<secreto_compartido>`

