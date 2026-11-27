"""
SADI · Microservicio Asterisk ARI + Early Media (SIP 183) Anti-Buzón Pre-Answer
==============================================================================
Analiza el flujo RTP de audio temprano (SIP 183 Session Progress) enviado por el
Gateway GSM OpenVox (SIMs Claro/Movistar/Tigo/WOM) ANTES de que el carrier envíe
SIP 200 OK. Si detecta locución continua de operadora, tono de buzón o supera el
timeout previo al salto de buzón (19s por defecto), ejecuta HANGUP/CANCEL vía ARI
para abortar la llamada con $0 COP de cobro del carrier y notifica a SADI webhook.
"""

from dataclasses import dataclass, field
from email import message_from_bytes
from email.header import decode_header
from email.message import EmailMessage
from email.utils import parseaddr, parsedate_to_datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import hashlib
import imaplib
import json
import math
import os
import re
import smtplib
import socket
import ssl
import struct
import threading
import time
import unicodedata
from typing import Callable, Optional
from urllib import error as urlerror
from urllib import parse as urlparse
from urllib import request as urlrequest
import base64

from openvox_sms_router import OpenVoxHttpAndCliTransport, OpenVoxSmsRouter, OpenVoxSshTransport

# ------------------------------------------------------------------------------
# TABLA DE DECODIFICACIÓN G.711 MU-LAW (ITU-T G.711) -> PCM16 LINEAL
# Implementación pura en Python (compatible Python 3.10 - 3.14 sin audioop)
# ------------------------------------------------------------------------------
def _build_ulaw_table():
    table = [0] * 256
    for i in range(256):
        u = (~i) & 0xFF
        sign = u & 0x80
        exponent = (u >> 4) & 0x07
        mantissa = u & 0x0F
        sample = ((mantissa << 3) + 0x84) << exponent
        sample -= 0x84
        table[i] = -sample if sign else sample
    return tuple(table)


ULAW_TO_PCM16 = _build_ulaw_table()

COLOMBIAN_CARRIER_PHRASES = (
    "buzon de voz",
    "buzon de mensajes",
    "correo de voz",
    "deje su mensaje",
    "despues del tono",
    "despues de la senal",
    "luego del tono",
    "no esta disponible",
    "fuera del area",
    "fuera de cobertura",
    "su llamada esta siendo transferida",
    "transferida al correo",
    "el usuario no puede contestar",
    "el abonado no contesta",
    "en este momento no se puede comunicar",
    "claro te informa",
    "movistar te informa",
    "tigo te informa",
    "wom te informa",
    "casilla de voz",
    "contestador automatico",
)

# Frecuencias objetivo en operadores móviles colombianos y beeps de buzón
TARGET_TONE_FREQS_HZ = (400.0, 425.0, 480.0, 950.0, 1000.0, 1400.0)


def normalize_es_text(text: str) -> str:
    lowered = str(text or "").lower()
    decomposed = unicodedata.normalize("NFD", lowered)
    stripped = "".join(ch for ch in decomposed if unicodedata.category(ch) != "Mn")
    return " ".join(stripped.split())


def classify_colombian_phrase(transcript: str) -> Optional[str]:
    norm = normalize_es_text(transcript)
    if not norm:
        return None
    for phrase in COLOMBIAN_CARRIER_PHRASES:
        if phrase in norm:
            return phrase
    return None


def decode_ulaw_bytes(payload: bytes) -> list[int]:
    return [ULAW_TO_PCM16[b] for b in payload]


def goertzel_power(samples: list[int], target_freq: float, sample_rate: int = 8000) -> float:
    n = len(samples)
    if n == 0:
        return 0.0
    k = int(0.5 + (n * target_freq) / sample_rate)
    omega = (2.0 * math.pi * k) / n
    coeff = 2.0 * math.cos(omega)
    q0 = 0.0
    q1 = 0.0
    q2 = 0.0
    for s in samples:
        q0 = coeff * q1 - q2 + float(s)
        q2 = q1
        q1 = q0
    power = q1 * q1 + q2 * q2 - q1 * q2 * coeff
    return max(0.0, power) / (n * n)


def compute_frame_metrics(samples: list[int], sample_rate: int = 8000) -> dict:
    n = len(samples)
    if n == 0:
        return {"rms": 0.0, "zcr": 0.0, "tone_ratio": 0.0, "dominant_freq": 0.0}

    energy_sum = 0.0
    zero_crossings = 0
    prev = samples[0]
    for idx, s in enumerate(samples):
        energy_sum += float(s) * float(s)
        if idx > 0 and ((s >= 0 > prev) or (s < 0 <= prev)):
            zero_crossings += 1
        prev = s

    rms = math.sqrt(energy_sum / n)
    zcr = zero_crossings / max(1, n - 1)

    total_power = (energy_sum / n) + 1e-9
    best_freq = 0.0
    best_ratio = 0.0
    for f in TARGET_TONE_FREQS_HZ:
        p = goertzel_power(samples, f, sample_rate=sample_rate)
        # Normalización frente a energía media de banda
        ratio = (2.0 * p) / total_power
        if ratio > best_ratio:
            best_ratio = ratio
            best_freq = f

    return {
        "rms": rms,
        "zcr": zcr,
        "tone_ratio": min(1.0, best_ratio),
        "dominant_freq": best_freq,
    }


@dataclass
class EarlyMediaDecision:
    should_cancel: bool
    reason: Optional[str] = None
    phase: Optional[str] = None
    sip_code: int = 183
    confidence: float = 0.0
    details: dict = field(default_factory=dict)


class EarlyMediaAnalyzer:
    """
    Evalúa paquetes RTP PCMU/ulaw (20 ms = 160 muestras @ 8kHz) durante la fase
    SIP 183 (Early Media) antes de que el carrier envíe SIP 200 OK.
    Distingue:
      - Tono de repique colombiano (~1.0s ON en 425Hz + ~4.0s silencio): NO corta.
      - Locución continua de operadora ("su llamada está siendo transferida..."): CORTA.
      - Beep/tono continuo de buzón (ej. 950Hz / 480Hz >= 320ms): CORTA.
      - Timeout previo al desvío al buzón (>= ring_timeout_sec sin 200 OK): CORTA.
    """

    def __init__(
        self,
        ring_timeout_sec: float = 19.0,
        speech_cutoff_ms: int = 1650,
        beep_cutoff_ms: int = 320,
        rms_active_threshold: float = 280.0,
        frame_ms: int = 20,
    ):
        self.ring_timeout_sec = ring_timeout_sec
        self.speech_cutoff_frames = max(10, speech_cutoff_ms // frame_ms)
        self.beep_cutoff_frames = max(5, beep_cutoff_ms // frame_ms)
        self.rms_active_threshold = rms_active_threshold
        self.frame_ms = frame_ms
        self.started_at = time.monotonic()

        self.active_speech_run = 0
        self.beep_tone_run = 0
        self.ringback_tone_run = 0
        self.silence_gap = 0
        self.total_frames = 0
        self.decided: Optional[EarlyMediaDecision] = None

    def process_ulaw_frame(self, ulaw_payload: bytes, elapsed_sec: Optional[float] = None) -> EarlyMediaDecision:
        if self.decided is not None:
            return self.decided

        self.total_frames += 1
        elapsed = elapsed_sec if elapsed_sec is not None else (time.monotonic() - self.started_at)

        if elapsed >= self.ring_timeout_sec:
            self.decided = EarlyMediaDecision(
                should_cancel=True,
                reason="ring-timeout-before-200ok",
                phase="ring_timeout_before_200ok",
                sip_code=487,
                confidence=0.98,
                details={"elapsed_sec": round(elapsed, 2)},
            )
            return self.decided

        samples = decode_ulaw_bytes(ulaw_payload)
        m = compute_frame_metrics(samples)
        is_active = m["rms"] >= self.rms_active_threshold

        if not is_active:
            self.silence_gap += 1
            if self.silence_gap >= 8:  # >= 160ms silencio reinicia rachas continuas
                self.active_speech_run = 0
                self.beep_tone_run = 0
                self.ringback_tone_run = 0
            return EarlyMediaDecision(should_cancel=False)

        self.silence_gap = 0

        # Tono puro en frecuencias de beep o SIT (480 / 950 / 1000 / 1400 Hz)
        # Un tono sinusoidal puro concentra >85% de la energía en su bin; habla multi-formante <75%.
        is_pure_tone = m["tone_ratio"] >= 0.78
        is_ringback_freq = is_pure_tone and m["dominant_freq"] in (400.0, 425.0)
        is_voicemail_beep_freq = is_pure_tone and m["dominant_freq"] in (480.0, 950.0, 1000.0, 1400.0)

        if is_ringback_freq:
            # Ringback colombiano dura ~1.0s (50 frames) seguido de ~4s de silencio.
            # Solo si un tono 425Hz dura > 1.8s continuos es tono anómalo/ocupado/operadora.
            self.ringback_tone_run += 1
            if self.ringback_tone_run >= 5:
                self.active_speech_run = 0
            self.beep_tone_run = 0
            if self.ringback_tone_run >= self.speech_cutoff_frames + 10:
                self.decided = EarlyMediaDecision(
                    should_cancel=True,
                    reason="sip-183-continuous-carrier-tone",
                    phase="pre_answer_sip_183",
                    sip_code=183,
                    confidence=0.90,
                    details={"dominant_freq": m["dominant_freq"], "frames": self.ringback_tone_run},
                )
                return self.decided
            return EarlyMediaDecision(should_cancel=False)

        self.ringback_tone_run = 0

        if is_voicemail_beep_freq:
            self.beep_tone_run += 1
            if self.beep_tone_run >= self.beep_cutoff_frames:
                self.decided = EarlyMediaDecision(
                    should_cancel=True,
                    reason="sip-183-early-media-beep",
                    phase="pre_answer_sip_183",
                    sip_code=183,
                    confidence=0.95,
                    details={"dominant_freq": m["dominant_freq"], "frames": self.beep_tone_run},
                )
                return self.decided
        else:
            self.beep_tone_run = 0

        # Energía vocal modulada continua (no es ringback 425Hz ni silencio): locución temprana
        if not is_pure_tone:
            self.active_speech_run += 1
            if self.active_speech_run >= self.speech_cutoff_frames:
                self.decided = EarlyMediaDecision(
                    should_cancel=True,
                    reason="sip-183-early-media-voicemail-speech",
                    phase="pre_answer_sip_183",
                    sip_code=183,
                    confidence=0.93,
                    details={"frames": self.active_speech_run, "rms": round(m["rms"], 1)},
                )
                return self.decided

        return EarlyMediaDecision(should_cancel=False)

    def process_transcript(self, text: str) -> EarlyMediaDecision:
        if self.decided is not None:
            return self.decided
        phrase = classify_colombian_phrase(text)
        if phrase:
            self.decided = EarlyMediaDecision(
                should_cancel=True,
                reason=f"sip-183-phrase:{phrase}",
                phase="pre_answer_sip_183",
                sip_code=183,
                confidence=0.99,
                details={"matched_phrase": phrase, "transcript": text},
            )
            return self.decided
        return EarlyMediaDecision(should_cancel=False)


# ------------------------------------------------------------------------------
# CLIENTE ARI + NOTIFICADOR A SADI WEBHOOK
# ------------------------------------------------------------------------------
def post_json(url: str, payload: dict, headers: Optional[dict] = None, timeout: float = 5.0) -> tuple[int, str]:
    data = json.dumps(payload).encode("utf-8")
    req_headers = {"Content-Type": "application/json"}
    if headers:
        req_headers.update(headers)
    req = urlrequest.Request(url, data=data, headers=req_headers, method="POST")
    with urlrequest.urlopen(req, timeout=timeout) as resp:
        return resp.status, resp.read().decode("utf-8", errors="ignore")


def ari_request(ari_base_url: str, ari_user: str, ari_pass: str, method: str, path: str, body: Optional[dict] = None):
    url = f"{ari_base_url.rstrip('/')}/{path.lstrip('/')}"
    token = base64.b64encode(f"{ari_user}:{ari_pass}".encode("utf-8")).decode("ascii")
    raw = json.dumps(body).encode("utf-8") if body is not None else None
    req = urlrequest.Request(
        url,
        data=raw,
        method=method,
        headers={
            "Authorization": f"Basic {token}",
            "Content-Type": "application/json",
        },
    )
    with urlrequest.urlopen(req, timeout=5.0) as resp:
        txt = resp.read().decode("utf-8", errors="ignore")
        return resp.status, (json.loads(txt) if txt else {})


def _cleanup_ari_resources(ari_base_url: str, ari_user: str, ari_pass: str, extra_channel_ids=(), bridge_ids=()):
    if not ari_base_url:
        return
    for cid in extra_channel_ids:
        if cid:
            try:
                ari_request(ari_base_url, ari_user, ari_pass, "DELETE", f"/channels/{cid}")
            except Exception:
                pass
    for bid in bridge_ids:
        if bid:
            try:
                ari_request(ari_base_url, ari_user, ari_pass, "DELETE", f"/bridges/{bid}")
            except Exception:
                pass


def cancel_ari_channel_and_notify(
    ari_base_url: str,
    ari_user: str,
    ari_pass: str,
    channel_id: str,
    webhook_url: str,
    webhook_secret: str,
    call_meta: dict,
    decision: EarlyMediaDecision,
    extra_channel_ids: tuple = (),
    bridge_ids: tuple = (),
) -> dict:
    ari_cancelled = False
    if ari_base_url and channel_id:
        try:
            status, _ = ari_request(ari_base_url, ari_user, ari_pass, "DELETE", f"/channels/{channel_id}")
            ari_cancelled = status in (200, 204)
        except Exception:
            ari_cancelled = False
        _cleanup_ari_resources(ari_base_url, ari_user, ari_pass, extra_channel_ids=extra_channel_ids, bridge_ids=bridge_ids)

    webhook_payload = {
        "phase": decision.phase or "pre_answer_sip_183",
        "callId": call_meta.get("callId") or channel_id,
        "patientId": call_meta.get("patientId"),
        "doctorId": call_meta.get("doctorId"),
        "hospitalId": call_meta.get("hospitalId"),
        "slotTanda": call_meta.get("slotTanda"),
        "phoneNumber": call_meta.get("phoneNumber"),
        "motivoLlamada": call_meta.get("motivoLlamada") or "Demanda Inducida Res. 3280",
        "sipCode": decision.sip_code,
        "reason": decision.reason,
        "confidence": decision.confidence,
        "transcript": decision.details.get("transcript", ""),
        "exhaustedTandas": bool(call_meta.get("exhaustedTandas", False)),
    }

    webhook_notified = False
    if webhook_url:
        hdrs = {"x-sadi-webhook-secret": webhook_secret} if webhook_secret else {}
        try:
            st, _ = post_json(webhook_url, webhook_payload, headers=hdrs)
            webhook_notified = 200 <= st < 300
        except Exception:
            webhook_notified = False

    return {
        "ari_cancelled": ari_cancelled,
        "webhook_notified": webhook_notified,
        "payload": webhook_payload,
    }


def parse_rtp_packet(packet: bytes) -> Optional[bytes]:
    if len(packet) <= 12:
        return None
    first_byte = packet[0]
    version = (first_byte >> 6) & 0x03
    if version != 2:
        return None
    csrc_count = first_byte & 0x0F
    has_extension = bool((first_byte >> 4) & 0x01)
    offset = 12 + csrc_count * 4
    if has_extension and len(packet) >= offset + 4:
        ext_len = struct.unpack("!HH", packet[offset : offset + 4])[1] * 4
        offset += 4 + ext_len
    if offset >= len(packet):
        return None
    return packet[offset:]


class EarlyMediaMonitorSession(threading.Thread):
    """Escucha el puerto UDP RTP asignado por ARI ExternalMedia hasta decisión o 200 OK."""

    def __init__(
        self,
        channel_id: str,
        call_meta: dict,
        ari_cfg: dict,
        webhook_url: str,
        webhook_secret: str,
        ring_timeout_sec: float = 19.0,
        on_decision: Optional[Callable[[EarlyMediaDecision], None]] = None,
    ):
        super().__init__(daemon=True)
        self.channel_id = channel_id
        self.call_meta = call_meta
        self.ari_cfg = ari_cfg
        self.webhook_url = webhook_url
        self.webhook_secret = webhook_secret
        self.analyzer = EarlyMediaAnalyzer(ring_timeout_sec=ring_timeout_sec)
        self.on_decision = on_decision
        self.pre_bridge_id = f"pre-{channel_id}"
        self.ext_channel_id: Optional[str] = None
        self.vapi_channel_id: Optional[str] = None
        self.stop_event = threading.Event()
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self.sock.bind(("0.0.0.0", 0))
        self.sock.settimeout(0.25)
        self.local_port = self.sock.getsockname()[1]

    def _cancel_and_notify(self, decision: EarlyMediaDecision):
        cancel_ari_channel_and_notify(
            self.ari_cfg.get("url", ""),
            self.ari_cfg.get("user", ""),
            self.ari_cfg.get("password", ""),
            self.channel_id,
            self.webhook_url,
            self.webhook_secret,
            self.call_meta,
            decision,
            extra_channel_ids=(self.ext_channel_id, self.vapi_channel_id),
            bridge_ids=(self.pre_bridge_id,),
        )
        if self.on_decision:
            self.on_decision(decision)

    def run(self):
        try:
            while not self.stop_event.is_set():
                try:
                    pkt, _ = self.sock.recvfrom(2048)
                    payload = parse_rtp_packet(pkt)
                    if payload:
                        decision = self.analyzer.process_ulaw_frame(payload)
                        if decision.should_cancel:
                            self._cancel_and_notify(decision)
                            break
                except socket.timeout:
                    # Comprobar timeout incluso sin tráfico RTP constante
                    decision = self.analyzer.process_ulaw_frame(b"")
                    if decision.should_cancel:
                        self._cancel_and_notify(decision)
                        break
        finally:
            self.sock.close()

    def stop(self):
        self.stop_event.set()


def bridge_human_call_to_vapi(
    ari_cfg: dict,
    channel_id: str,
    phone: str,
    bridge_id: Optional[str] = None,
    ext_channel_id: Optional[str] = None,
):
    """
    Cuando la persona real contesta (ChannelStateChange -> Up / 200 OK),
    retira ExternalMedia y enlaza en caliente el canal GSM dentro del bridge
    ARI hacia PJSIP/{phone}@vapi-sip-trunk usando create + addChannel + dial.
    """
    bridge_id = bridge_id or f"pre-{channel_id}"
    if ext_channel_id:
        try:
            ari_request(ari_cfg["url"], ari_cfg["user"], ari_cfg["password"], "DELETE", f"/channels/{ext_channel_id}")
        except Exception:
            pass

    vapi_chan_id = f"vapi-{channel_id}"
    ari_request(
        ari_cfg["url"],
        ari_cfg["user"],
        ari_cfg["password"],
        "POST",
        "/channels/create",
        {
            "endpoint": f"PJSIP/{phone}@vapi-sip-trunk",
            "app": ari_cfg["app"],
            "appArgs": f"vapi_bridge,{bridge_id}",
            "channelId": vapi_chan_id,
        },
    )
    ari_request(ari_cfg["url"], ari_cfg["user"], ari_cfg["password"], "POST", f"/bridges/{bridge_id}/addChannel", {"channel": vapi_chan_id})
    ari_request(ari_cfg["url"], ari_cfg["user"], ari_cfg["password"], "POST", f"/channels/{vapi_chan_id}/dial", {"timeout": 30})
    return bridge_id, vapi_chan_id


def _ws_read_frame(sock: socket.socket) -> Optional[str]:
    """Lector mínimo RFC 6455 para frames de texto enviados por Asterisk ARI."""
    hdr = sock.recv(2)
    if len(hdr) < 2:
        return None
    opcode = hdr[0] & 0x0F
    if opcode == 0x8:  # Close
        return None
    length = hdr[1] & 0x7F
    if length == 126:
        length = struct.unpack("!H", sock.recv(2))[0]
    elif length == 127:
        length = struct.unpack("!Q", sock.recv(8))[0]
    chunks = bytearray()
    while len(chunks) < length:
        chunk = sock.recv(min(4096, length - len(chunks)))
        if not chunk:
            return None
        chunks.extend(chunk)
    if opcode == 0x9:  # Ping -> responder Pong vacío
        sock.sendall(bytes([0x8A, 0x00]))
        return ""
    return chunks.decode("utf-8", errors="ignore")


class AsteriskAriWsBridgeClient(threading.Thread):
    """
    Escucha eventos ARI en tiempo real por WebSocket:
      - Si el canal GSM transiciona a `Up` (humano contestó con 200 OK): detiene
        el analizador de Early Media y enlaza automáticamente con Vapi SIP.
      - Si el canal termina (`ChannelDestroyed` / `StasisEnd`): libera el monitor.
    """

    def __init__(self, ari_cfg: dict, sessions: dict):
        super().__init__(daemon=True)
        self.ari_cfg = ari_cfg
        self.sessions = sessions
        self.stop_event = threading.Event()

    def _handle_event(self, ev: dict):
        ev_type = ev.get("type")
        chan = ev.get("channel") or {}
        cid = chan.get("id")
        if not cid:
            return

        if ev_type == "ChannelStateChange" and chan.get("state") == "Up":
            sess = self.sessions.get(cid)
            if sess and not sess.stop_event.is_set():
                sess.stop()
                phone = (sess.call_meta or {}).get("phoneNumber") or chan.get("dialplan", {}).get("exten") or ""
                try:
                    _, vapi_cid = bridge_human_call_to_vapi(
                        self.ari_cfg,
                        cid,
                        phone,
                        bridge_id=sess.pre_bridge_id,
                        ext_channel_id=sess.ext_channel_id,
                    )
                    sess.ext_channel_id = None
                    sess.vapi_channel_id = vapi_cid
                except Exception as exc:
                    print(f"[ARI-WS] Error enlazando humano con Vapi ({cid}): {exc}")

        elif ev_type in ("ChannelDestroyed", "StasisEnd"):
            if cid.startswith("vapi-"):
                base_cid = cid[len("vapi-"):]
                sess = self.sessions.pop(base_cid, None)
                if sess:
                    sess.stop()
                    _cleanup_ari_resources(
                        self.ari_cfg.get("url", ""),
                        self.ari_cfg.get("user", ""),
                        self.ari_cfg.get("password", ""),
                        extra_channel_ids=(base_cid, sess.ext_channel_id),
                        bridge_ids=(sess.pre_bridge_id,),
                    )
                return

            sess = self.sessions.pop(cid, None)
            if sess:
                sess.stop()
                _cleanup_ari_resources(
                    self.ari_cfg.get("url", ""),
                    self.ari_cfg.get("user", ""),
                    self.ari_cfg.get("password", ""),
                    extra_channel_ids=(sess.ext_channel_id, sess.vapi_channel_id),
                    bridge_ids=(sess.pre_bridge_id,),
                )

    def run(self):
        parsed = urlparse.urlparse(self.ari_cfg.get("url", "http://127.0.0.1:8088/ari"))
        host = parsed.hostname or "127.0.0.1"
        port = parsed.port or 8088
        app = urlparse.quote(self.ari_cfg.get("app", "sadi_anti_voicemail"))
        key_bytes = base64.b64encode(os.urandom(16)).decode("ascii")
        auth_raw = f"{self.ari_cfg.get('user', '')}:{self.ari_cfg.get('password', '')}".encode("utf-8")
        auth_b64 = base64.b64encode(auth_raw).decode("ascii")
        ws_path = f"{parsed.path.rstrip('/')}/events?app={app}&subscribeAll=false"

        while not self.stop_event.is_set():
            sock = None
            try:
                sock = socket.create_connection((host, port), timeout=5.0)
                sock.settimeout(None)
                handshake = (
                    f"GET {ws_path} HTTP/1.1\r\n"
                    f"Host: {host}:{port}\r\n"
                    f"Upgrade: websocket\r\n"
                    f"Connection: Upgrade\r\n"
                    f"Sec-WebSocket-Key: {key_bytes}\r\n"
                    f"Sec-WebSocket-Version: 13\r\n"
                    f"Authorization: Basic {auth_b64}\r\n\r\n"
                )
                sock.sendall(handshake.encode("ascii"))
                resp = sock.recv(2048).decode("utf-8", errors="ignore")
                if "101" not in resp.splitlines()[0]:
                    raise RuntimeError(f"ARI WS handshake rechazado: {resp[:120]}")
                expected = base64.b64encode(
                    hashlib.sha1((key_bytes + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").encode("ascii")).digest()
                ).decode("ascii")
                if expected not in resp:
                    raise RuntimeError("ARI WS Accept inválido")

                while not self.stop_event.is_set():
                    msg = _ws_read_frame(sock)
                    if msg is None:
                        break
                    if msg:
                        try:
                            self._handle_event(json.loads(msg))
                        except Exception:
                            pass
            except Exception:
                time.sleep(3.0)
            finally:
                if sock:
                    try:
                        sock.close()
                    except Exception:
                        pass


def run_bridge_http_server():
    ari_cfg = {
        "url": os.environ.get("ASTERISK_ARI_URL", "http://127.0.0.1:8088/ari"),
        "user": os.environ.get("ASTERISK_ARI_USER", "sadi"),
        "password": os.environ.get("ASTERISK_ARI_PASSWORD", ""),
        "app": os.environ.get("ASTERISK_ARI_APP", "sadi_anti_voicemail"),
        "external_host": os.environ.get("EXTERNAL_RTP_HOST", "127.0.0.1"),
    }
    bridge_secret = os.environ.get("ASTERISK_BRIDGE_SECRET", "")
    port = int(os.environ.get("BRIDGE_HTTP_PORT", "8090"))
    sessions: dict[str, EarlyMediaMonitorSession] = {}

    # Iniciar cliente WebSocket ARI para puenteo automático cuando conteste un humano
    ari_ws = AsteriskAriWsBridgeClient(ari_cfg=ari_cfg, sessions=sessions)
    ari_ws.start()

    # Inicializar router SMS OpenVox multi-puerto (Puertos 1..32, sin Twilio)
    ports_env = os.environ.get("OPENVOX_SMS_PORTS", "")
    configured_ports = [int(p.strip()) for p in ports_env.split(",") if p.strip().isdigit()] or [13] + [p for p in range(1, 33) if p != 13]
    use_ssh_cli = os.environ.get("OPENVOX_USE_SSH_CLI", "false").lower() == "true"
    if use_ssh_cli:
        sms_transport = OpenVoxSshTransport(
            ssh_host=os.environ.get("OPENVOX_SSH_HOST") or os.environ.get("OPENVOX_GATEWAY_HOST", "190.90.52.5"),
            ssh_port=int(os.environ.get("OPENVOX_SSH_PORT", "12345")),
            ssh_user=os.environ.get("OPENVOX_SSH_USER") or os.environ.get("OPENVOX_API_USER", "admin"),
            ssh_pass=os.environ.get("OPENVOX_SSH_PASSWORD") or os.environ.get("OPENVOX_API_PASSWORD", ""),
            status_poll_sec=float(os.environ.get("OPENVOX_SMS_POLL_SEC", "12.0")),
        )
    else:
        sms_transport = OpenVoxHttpAndCliTransport(
            gateway_host=os.environ.get("OPENVOX_GATEWAY_HOST", ""),
            api_user=os.environ.get("OPENVOX_API_USER", "admin"),
            api_pass=os.environ.get("OPENVOX_API_PASSWORD", ""),
            use_asterisk_cli=os.environ.get("OPENVOX_USE_ASTERISK_CLI", "false").lower() == "true",
        )
    sms_router = OpenVoxSmsRouter(transport=sms_transport, ports=configured_ports, attempt_timeout_sec=18.0)

    def _dispatch_email_smtp_or_resend(payload: dict) -> tuple[int, dict]:
        to_email = str(payload.get("to") or "").strip()
        subject = str(payload.get("subject") or "Notificación SADI Res. 3280").strip()
        text_body = str(payload.get("text") or "").strip()
        html_body = str(payload.get("html") or "").strip()
        if not to_email or "@" not in to_email:
            return 400, {"ok": False, "error": "Correo destino inválido"}

        override = payload.get("smtpOverride") if isinstance(payload.get("smtpOverride"), dict) else {}
        resend_key = str(override.get("resendApiKey") or os.environ.get("RESEND_API_KEY") or "").strip()
        if resend_key:
            from_addr = str(payload.get("fromEmail") or override.get("fromEmail") or os.environ.get("EMAIL_FROM") or "SADI Salud <onboarding@resend.dev>").strip()
            body_json = json.dumps({
                "from": from_addr,
                "to": [to_email],
                "subject": subject,
                "html": html_body or f"<pre>{text_body}</pre>",
                "text": text_body or subject,
            }).encode("utf-8")
            req = urlrequest.Request(
                "https://api.resend.com/emails",
                data=body_json,
                headers={"Authorization": f"Bearer {resend_key}", "Content-Type": "application/json"},
                method="POST",
            )
            try:
                with urlrequest.urlopen(req, timeout=15) as r:
                    resp_d = json.loads(r.read().decode("utf-8", errors="ignore") or "{}")
                    return 200, {"ok": True, "provider": "resend", "messageId": resp_d.get("id")}
            except urlerror.HTTPError as he:
                err_txt = he.read().decode("utf-8", errors="ignore")[:300]
                return 502, {"ok": False, "provider": "resend", "error": f"Resend HTTP {he.code}: {err_txt}"}
            except Exception as exc:
                return 502, {"ok": False, "provider": "resend", "error": str(exc)}

        smtp_host = str(override.get("host") or os.environ.get("SMTP_HOST") or "").strip()
        smtp_port = int(override.get("port") or os.environ.get("SMTP_PORT") or "587")
        smtp_user = str(override.get("user") or os.environ.get("SMTP_USER") or "").strip()
        smtp_pass = str(override.get("pass") or os.environ.get("SMTP_PASS") or "").strip()
        from_email = str(payload.get("fromEmail") or override.get("fromEmail") or os.environ.get("SMTP_FROM") or smtp_user or "notificaciones@sadi.apropiatic.com.co").strip()
        from_name = str(payload.get("fromName") or os.environ.get("SMTP_FROM_NAME") or "SADI · Demanda Inducida Res. 3280").strip()

        if not smtp_host or not smtp_user or not smtp_pass:
            return 503, {
                "ok": False,
                "missingConfig": True,
                "error": "SMTP/Resend no configurado (faltan SMTP_HOST, SMTP_USER, SMTP_PASS o RESEND_API_KEY).",
            }

        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = f"{from_name} <{from_email}>" if "<" not in from_email else from_email
        msg["To"] = to_email
        msg.set_content(text_body or subject)
        if html_body:
            msg.add_alternative(html_body, subtype="html")

        try:
            ctx = ssl.create_default_context()
            if smtp_port == 465:
                with smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=15, context=ctx) as srv:
                    srv.login(smtp_user, smtp_pass)
                    srv.send_message(msg)
            else:
                with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as srv:
                    srv.ehlo()
                    srv.starttls(context=ctx)
                    srv.ehlo()
                    srv.login(smtp_user, smtp_pass)
                    srv.send_message(msg)
            return 200, {"ok": True, "provider": "smtp", "smtpHost": smtp_host, "messageId": msg.get("Message-ID") or f"smtp-{int(time.time()*1000)}"}
        except Exception as exc:
            return 502, {"ok": False, "provider": "smtp", "error": f"Error SMTP ({smtp_host}:{smtp_port}): {exc}"}

    def _decode_mime_header(raw_val: str) -> str:
        parts = []
        for chunk, enc in decode_header(str(raw_val or "")):
            if isinstance(chunk, bytes):
                parts.append(chunk.decode(enc or "utf-8", errors="ignore"))
            else:
                parts.append(str(chunk))
        return "".join(parts).strip()

    def _extract_reply_top_text(raw_body: str) -> str:
        lines = []
        for ln in str(raw_body or "").replace("\r\n", "\n").split("\n"):
            s = ln.strip()
            if s.startswith(">"):
                break
            if re.match(r"^(el\s+.+escribi[oó]:|on\s+.+wrote:|---+\s*original\s+message|de:\s+.+sadi@)", s, re.IGNORECASE):
                break
            lines.append(ln)
        return "\n".join(lines).strip()

    def _fetch_imap_email_inbox(limit: int = 40) -> list[dict]:
        imap_host = str(os.environ.get("IMAP_HOST") or os.environ.get("SMTP_HOST") or "").strip()
        imap_port = int(os.environ.get("IMAP_PORT") or "993")
        imap_user = str(os.environ.get("IMAP_USER") or os.environ.get("SMTP_USER") or "").strip()
        imap_pass = str(os.environ.get("IMAP_PASS") or os.environ.get("SMTP_PASS") or "").strip()
        if not imap_host or not imap_user or not imap_pass:
            return []
        safe_limit = max(1, min(100, int(limit or 40)))
        results = []
        try:
            with imaplib.IMAP4_SSL(imap_host, imap_port, timeout=12) as srv:
                srv.login(imap_user, imap_pass)
                st, _ = srv.select("INBOX", readonly=True)
                if st != "OK":
                    return []
                st_s, data = srv.uid("search", None, "ALL")
                if st_s != "OK" or not data or not data[0]:
                    return []
                uids = data[0].split()[-safe_limit:]
                for uid_b in reversed(uids):
                    uid_str = uid_b.decode("ascii", errors="ignore")
                    st_f, msg_data = srv.uid("fetch", uid_b, "(RFC822)")
                    if st_f != "OK" or not msg_data or not isinstance(msg_data[0], tuple):
                        continue
                    parsed = message_from_bytes(msg_data[0][1])
                    _, from_addr = parseaddr(parsed.get("From", ""))
                    from_addr = (from_addr or "").strip().lower()
                    if not from_addr or from_addr == imap_user.lower():
                        continue
                    subject = _decode_mime_header(parsed.get("Subject", ""))
                    date_hdr = parsed.get("Date", "")
                    received_iso = ""
                    try:
                        dt = parsedate_to_datetime(date_hdr)
                        if dt is not None:
                            received_iso = dt.isoformat()
                    except Exception:
                        received_iso = ""
                    body_text = ""
                    if parsed.is_multipart():
                        for part in parsed.walk():
                            ctype = part.get_content_type()
                            disp = str(part.get("Content-Disposition") or "").lower()
                            if ctype == "text/plain" and "attachment" not in disp:
                                payload_b = part.get_payload(decode=True)
                                if payload_b:
                                    charset = part.get_content_charset() or "utf-8"
                                    body_text = payload_b.decode(charset, errors="ignore")
                                    break
                    else:
                        payload_b = parsed.get_payload(decode=True)
                        if payload_b:
                            charset = parsed.get_content_charset() or "utf-8"
                            body_text = payload_b.decode(charset, errors="ignore")
                    clean_reply = _extract_reply_top_text(body_text)
                    results.append({
                        "uid": uid_str,
                        "fromEmail": from_addr,
                        "subject": subject,
                        "receivedAtIso": received_iso,
                        "message": clean_reply[:600],
                    })
        except Exception:
            return []
        return results

    class BridgeHandler(BaseHTTPRequestHandler):
        def _send(self, code: int, body: dict):
            raw = json.dumps(body).encode("utf-8")
            self.send_response(code)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)

        def do_GET(self):
            if self.path == "/health":
                self._send(200, {"ok": True, "service": "sadi-openvox-amd-sms", "activeSessions": len(sessions)})
                return
            if self.path == "/sadi/openvox-ports-status":
                statuses = sms_transport.get_ports_status()
                self._send(200, {
                    "ok": True,
                    "ports": {str(k): {"registered": v.registered, "rssi": v.signal_rssi, "operator": v.operator} for k, v in statuses.items()},
                })
                return
            if self.path == "/sadi/email-status":
                has_resend = bool(os.environ.get("RESEND_API_KEY", "").strip())
                has_smtp = bool(os.environ.get("SMTP_HOST", "").strip() and os.environ.get("SMTP_USER", "").strip() and os.environ.get("SMTP_PASS", "").strip())
                has_imap = bool((os.environ.get("IMAP_HOST") or os.environ.get("SMTP_HOST") or "").strip() and (os.environ.get("IMAP_USER") or os.environ.get("SMTP_USER") or "").strip() and (os.environ.get("IMAP_PASS") or os.environ.get("SMTP_PASS") or "").strip())
                self._send(200, {
                    "ok": True,
                    "configured": has_resend or has_smtp,
                    "imapConfigured": has_imap,
                    "provider": "resend" if has_resend else ("smtp" if has_smtp else None),
                    "smtpHost": os.environ.get("SMTP_HOST", "").strip() or None,
                    "fromEmail": (os.environ.get("SMTP_FROM") or os.environ.get("SMTP_USER") or "").strip() or None,
                })
                return
            self._send(404, {"error": "Not found"})

        def do_POST(self):
            if bridge_secret and self.headers.get("x-sadi-bridge-secret", "") != bridge_secret:
                self._send(401, {"ok": False, "error": "Unauthorized"})
                return

            length = int(self.headers.get("Content-Length", "0"))
            raw = self.rfile.read(length).decode("utf-8", errors="ignore")
            data = json.loads(raw or "{}")

            if self.path == "/sadi/email-inbox":
                limit = int(data.get("limit") or 40)
                messages = _fetch_imap_email_inbox(limit=limit)
                self._send(200, {"ok": True, "count": len(messages), "messages": messages})
                return

            if self.path == "/sadi/openvox-sms-inbox":
                limit = int(data.get("limit") or 100)
                port_filter = data.get("port")
                port_int = int(port_filter) if port_filter not in (None, "") else None
                fetcher = getattr(sms_transport, "fetch_inbound_sms", None)
                messages = fetcher(limit=limit, port=port_int) if callable(fetcher) else []
                self._send(200, {"ok": True, "count": len(messages), "messages": messages})
                return

            if self.path == "/sadi/openvox-sms-send":
                phone = str(data.get("phoneNumber", "")).strip()
                msg_body = str(data.get("message", "")).strip()
                idem_key = str(data.get("idempotencyKey") or f"sms-{int(time.time() * 1000)}-{phone}")
                preferred = data.get("preferredPorts")
                if not phone or not msg_body:
                    self._send(400, {"ok": False, "error": "phoneNumber y message son obligatorios"})
                    return

                rep = sms_router.send_with_failover(
                    to_phone=phone,
                    message=msg_body,
                    idempotency_key=idem_key,
                    preferred_ports=preferred if isinstance(preferred, list) else None,
                )
                self._send(200 if rep.ok else 502, {
                    "ok": rep.ok,
                    "status": rep.status,
                    "idempotencyKey": rep.idempotency_key,
                    "winningPort": rep.winning_port,
                    "portsAttempted": rep.ports_attempted,
                    "purgedPorts": rep.purged_ports,
                    "messageEliminated": rep.message_eliminated,
                    "gatewayMessageId": rep.gateway_message_id,
                    "attempts": rep.attempts,
                    "errorReason": rep.error_reason,
                })
                return

            if self.path == "/sadi/send-email":
                code, resp = _dispatch_email_smtp_or_resend(data)
                self._send(code, resp)
                return

            if self.path == "/sadi/preanswer-call":
                phone = str(data.get("phoneNumber", "")).strip()
                if not phone:
                    self._send(400, {"ok": False, "error": "phoneNumber requerido"})
                    return

                ring_timeout = float(data.get("ringTimeoutSeconds", 19.0))
                webhook_url = str(data.get("webhookUrl") or os.environ.get("SADI_WEBHOOK_URL") or "")
                webhook_secret = str(data.get("webhookSecret") or os.environ.get("VAPI_WEBHOOK_SECRET") or "")
                channel_id = f"sadi-{int(time.time() * 1000)}"

                monitor = EarlyMediaMonitorSession(
                    channel_id=channel_id,
                    call_meta={**data, "callId": channel_id},
                    ari_cfg=ari_cfg,
                    webhook_url=webhook_url,
                    webhook_secret=webhook_secret,
                    ring_timeout_sec=ring_timeout,
                )
                monitor.start()
                sessions[channel_id] = monitor

                # Bridge pre-answer + ExternalMedia + channels/create + dial para recibir SIP 183 antes del 200 OK
                try:
                    ari_request(
                        ari_cfg["url"],
                        ari_cfg["user"],
                        ari_cfg["password"],
                        "POST",
                        f"/bridges/{monitor.pre_bridge_id}",
                        {"type": "mixing"},
                    )
                    _, ext_data = ari_request(
                        ari_cfg["url"],
                        ari_cfg["user"],
                        ari_cfg["password"],
                        "POST",
                        "/channels/externalMedia",
                        {
                            "app": ari_cfg["app"],
                            "external_host": f"{ari_cfg['external_host']}:{monitor.local_port}",
                            "encapsulation": "rtp",
                            "transport": "udp",
                            "connection_type": "client",
                            "format": "ulaw",
                            "direction": "both",
                        },
                    )
                    ext_id = ext_data.get("id") if isinstance(ext_data, dict) else None
                    monitor.ext_channel_id = ext_id
                    if ext_id:
                        ari_request(
                            ari_cfg["url"],
                            ari_cfg["user"],
                            ari_cfg["password"],
                            "POST",
                            f"/bridges/{monitor.pre_bridge_id}/addChannel",
                            {"channel": ext_id},
                        )

                    ari_request(
                        ari_cfg["url"],
                        ari_cfg["user"],
                        ari_cfg["password"],
                        "POST",
                        "/channels/create",
                        {
                            "endpoint": f"PJSIP/{phone}@openvox-gsm-32p",
                            "app": ari_cfg["app"],
                            "appArgs": f"preanswer,{monitor.pre_bridge_id}",
                            "channelId": channel_id,
                            "variables": {
                                "SADI_PATIENT_ID": str(data.get("patientId") or ""),
                                "SADI_DOCTOR_ID": str(data.get("doctorId") or ""),
                                "SADI_HOSPITAL_ID": str(data.get("hospitalId") or ""),
                                "SADI_RING_MAX": str(int(ring_timeout)),
                            },
                        },
                    )
                    ari_request(
                        ari_cfg["url"],
                        ari_cfg["user"],
                        ari_cfg["password"],
                        "POST",
                        f"/bridges/{monitor.pre_bridge_id}/addChannel",
                        {"channel": channel_id},
                    )
                    ari_request(
                        ari_cfg["url"],
                        ari_cfg["user"],
                        ari_cfg["password"],
                        "POST",
                        f"/channels/{channel_id}/dial",
                        {"timeout": int(ring_timeout)},
                    )
                    self._send(200, {
                        "ok": True,
                        "callId": channel_id,
                        "preBridgeId": monitor.pre_bridge_id,
                        "rtpMonitorPort": monitor.local_port,
                        "ringTimeoutSeconds": ring_timeout,
                    })
                except Exception as exc:
                    monitor.stop()
                    sessions.pop(channel_id, None)
                    _cleanup_ari_resources(
                        ari_cfg["url"],
                        ari_cfg["user"],
                        ari_cfg["password"],
                        extra_channel_ids=(channel_id, monitor.ext_channel_id),
                        bridge_ids=(monitor.pre_bridge_id,),
                    )
                    self._send(502, {"ok": False, "error": f"ARI origen falló: {exc}"})
                return

            self._send(404, {"error": "Not found"})

    server = ThreadingHTTPServer(("0.0.0.0", port), BridgeHandler)
    print(f"SADI Asterisk Early Media (SIP 183) Bridge escuchando en :{port}")
    server.serve_forever()


if __name__ == "__main__":
    run_bridge_http_server()
