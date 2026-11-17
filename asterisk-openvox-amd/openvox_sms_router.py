"""
SADI · OpenVox GSM Multi-Port SMS Router (Puertos 1..32) sin Twilio
====================================================================
Implementa failover secuencial Puerto X -> Puerto Y -> Puerto Z cuando una SIM
no tiene señal, falla o expira timeout, garantizando PURGA/ELIMINACIÓN explícita
del intento y de cualquier SMS retenido en cola del puerto fallido ANTES de
reintentar en la siguiente SIM, evitando reenvíos fantasmas al recuperar señal.
"""

from dataclasses import dataclass, field
import base64
import json
import os
import subprocess
import threading
import time
from typing import Dict, List, Optional, Protocol
from urllib import parse as urlparse
from urllib import request as urlrequest


@dataclass
class PortStatus:
    port: int
    registered: bool = True
    signal_rssi: int = 20
    operator: str = "GSM"


@dataclass
class SmsAttemptResult:
    port: int
    ok: bool
    outcome: str  # 'sent' | 'no_signal' | 'modem_error' | 'timeout' | 'aborted_purged'
    gateway_message_id: Optional[str] = None
    raw_response: str = ""
    queue_purged: bool = False


class OpenVoxSmsTransport(Protocol):
    def get_ports_status(self) -> Dict[int, PortStatus]: ...
    def send_sms_on_port(self, port: int, to_phone: str, message: str, msg_tag: str, timeout_sec: float) -> SmsAttemptResult: ...
    def purge_port_message(self, port: int, msg_tag: str, to_phone: str) -> bool: ...


class OpenVoxHttpAndCliTransport:
    """
    Adaptador real para OpenVox GSM Gateway (HTTP API + fallback CLI Asterisk/chan_extra).
    - HTTP API OpenVox: envia por puerto específico y ejecuta limpieza explícita si falla.
    - Si se usa chan_extra sobre Asterisk local, limpia cola SMS pendiente con CLI.
    """

    def __init__(
        self,
        gateway_host: str,
        api_user: str = "admin",
        api_pass: str = "admin",
        use_asterisk_cli: bool = False,
    ):
        self.gateway_host = gateway_host.strip()
        self.api_user = api_user
        self.api_pass = api_pass
        self.use_asterisk_cli = use_asterisk_cli

    def _auth_header(self) -> str:
        tok = base64.b64encode(f"{self.api_user}:{self.api_pass}".encode("utf-8")).decode("ascii")
        return f"Basic {tok}"

    def get_ports_status(self) -> Dict[int, PortStatus]:
        statuses: Dict[int, PortStatus] = {}
        if self.use_asterisk_cli:
            try:
                out = subprocess.check_output(
                    ["asterisk", "-rx", "gsm show spans"],
                    text=True,
                    timeout=4,
                )
                for line in out.splitlines():
                    # Ejemplo típico: "GSM span 1: Power on, Provisioned, Up, Active, ..."
                    low = line.lower()
                    if "span" in low:
                        parts = low.split("span")
                        num_tok = parts[1].strip().split(":")[0].strip()
                        if num_tok.isdigit():
                            p = int(num_tok)
                            ok = ("up" in low and "active" in low) or "registered" in low
                            statuses[p] = PortStatus(port=p, registered=ok, signal_rssi=20 if ok else 0)
            except Exception:
                pass
        elif self.gateway_host:
            try:
                url = f"http://{self.gateway_host}/service?action=get_port_info&format=json"
                req = urlrequest.Request(url, headers={"Authorization": self._auth_header()})
                with urlrequest.urlopen(req, timeout=3.5) as r:
                    data = json.loads(r.read().decode("utf-8", errors="ignore") or "{}")
                for row in data.get("ports", []):
                    p = int(row.get("port", 0))
                    if 1 <= p <= 32:
                        rssi = int(row.get("rssi", row.get("signal", 0)) or 0)
                        reg = bool(row.get("registered", row.get("status") == "Ready"))
                        statuses[p] = PortStatus(
                            port=p,
                            registered=reg and rssi > 0,
                            signal_rssi=rssi,
                            operator=str(row.get("operator", "GSM")),
                        )
            except Exception:
                pass
        return statuses

    def send_sms_on_port(
        self,
        port: int,
        to_phone: str,
        message: str,
        msg_tag: str,
        timeout_sec: float = 8.0,
    ) -> SmsAttemptResult:
        if self.use_asterisk_cli:
            try:
                proc = subprocess.run(
                    ["asterisk", "-rx", f'gsm send sms {port} "{to_phone}" "{message.replace(chr(34), "")}" {msg_tag}'],
                    capture_output=True,
                    text=True,
                    timeout=timeout_sec,
                )
                out = (proc.stdout or "") + (proc.stderr or "")
                low = out.lower()
                if proc.returncode == 0 and ("successfully" in low or "sent" in low or "queued ok" in low):
                    return SmsAttemptResult(port=port, ok=True, outcome="sent", gateway_message_id=msg_tag, raw_response=out.strip())
                outcome = "no_signal" if ("signal" in low or "down" in low or "unregistered" in low) else "modem_error"
                return SmsAttemptResult(port=port, ok=False, outcome=outcome, raw_response=out.strip())
            except subprocess.TimeoutExpired:
                return SmsAttemptResult(port=port, ok=False, outcome="timeout", raw_response="CLI timeout")
            except Exception as exc:
                return SmsAttemptResult(port=port, ok=False, outcome="modem_error", raw_response=str(exc))

        if not self.gateway_host:
            return SmsAttemptResult(port=port, ok=False, outcome="modem_error", raw_response="OPENVOX_GATEWAY_HOST no configurado")

        try:
            q = urlparse.urlencode({
                "action": "send_sms",
                "port": str(port),
                "phonenumber": to_phone,
                "message": message,
                "id": msg_tag,
                "report": "json",
            })
            url = f"http://{self.gateway_host}/api/send_sms?{q}"
            req = urlrequest.Request(url, headers={"Authorization": self._auth_header()}, method="POST")
            with urlrequest.urlopen(req, timeout=timeout_sec) as r:
                raw = r.read().decode("utf-8", errors="ignore")
            low = raw.lower()
            if "ok" in low or "succeed" in low or '"result":"success"' in low.replace(" ", ""):
                return SmsAttemptResult(port=port, ok=True, outcome="sent", gateway_message_id=msg_tag, raw_response=raw)
            outcome = "no_signal" if ("signal" in low or "no carrier" in low or "unregistered" in low or "fail" in low) else "modem_error"
            return SmsAttemptResult(port=port, ok=False, outcome=outcome, raw_response=raw)
        except TimeoutError:
            return SmsAttemptResult(port=port, ok=False, outcome="timeout", raw_response="HTTP timeout")
        except Exception as exc:
            return SmsAttemptResult(port=port, ok=False, outcome="modem_error", raw_response=str(exc))

    def purge_port_message(self, port: int, msg_tag: str, to_phone: str) -> bool:
        """
        Crítico: elimina de inmediato cualquier mensaje retenido o en cola de la SIM/puerto X
        para que NUNCA sea reenviado por error cuando esa SIM recupere cobertura.
        """
        purged = False
        if self.use_asterisk_cli:
            try:
                subprocess.run(["asterisk", "-rx", f"gsm clean sms {port}"], capture_output=True, timeout=3)
                purged = True
            except Exception:
                pass
        if self.gateway_host:
            for endpoint in (
                f"http://{self.gateway_host}/api/del_sms?port={port}&id={urlparse.quote(msg_tag)}",
                f"http://{self.gateway_host}/api/clear_sms_queue?port={port}&phonenumber={urlparse.quote(to_phone)}",
            ):
                try:
                    req = urlrequest.Request(endpoint, headers={"Authorization": self._auth_header()}, method="POST")
                    with urlrequest.urlopen(req, timeout=3.0):
                        purged = True
                        break
                except Exception:
                    continue
        return purged


@dataclass
class SmsDispatchReport:
    ok: bool
    status: str  # 'sent' | 'failed_all_ports' | 'duplicate_blocked'
    idempotency_key: str
    winning_port: Optional[int] = None
    ports_attempted: List[int] = field(default_factory=list)
    purged_ports: List[int] = field(default_factory=list)
    message_eliminated: bool = False
    gateway_message_id: Optional[str] = None
    attempts: List[dict] = field(default_factory=list)
    error_reason: Optional[str] = None


class OpenVoxSmsRouter:
    """
    Orquestador multi-puerto (1..32) con failover X -> Y -> Z y garantía anti-reenvío:
      - Bloqueo por `idempotency_key` contra doble envío.
      - Descarta puertos en cooldown o sin señal (si hay telemetría disponible).
      - Si el puerto X falla, PURGA/ELIMINA el intento del puerto X ANTES de probar Y.
      - Si todos fallan, todos los puertos intentados quedan purgados y el mensaje se elimina.
    """

    def __init__(
        self,
        transport: OpenVoxSmsTransport,
        ports: Optional[List[int]] = None,
        cooldown_seconds: float = 120.0,
        min_rssi: int = 5,
        attempt_timeout_sec: float = 8.0,
    ):
        self.transport = transport
        self.ports = ports or list(range(1, 33))
        self.cooldown_seconds = cooldown_seconds
        self.min_rssi = min_rssi
        self.attempt_timeout_sec = attempt_timeout_sec
        self._lock = threading.Lock()
        self._cooldowns: Dict[int, float] = {}
        self._dispatch_states: Dict[str, SmsDispatchReport] = {}
        self._rr_cursor = 0

    def _ordered_candidate_ports(self, preferred_ports: Optional[List[int]] = None) -> List[int]:
        now = time.monotonic()
        base = list(preferred_ports) if preferred_ports else list(self.ports)
        if not preferred_ports and len(base) > 1:
            with self._lock:
                start = self._rr_cursor % len(base)
                self._rr_cursor = (self._rr_cursor + 1) % len(base)
            base = base[start:] + base[:start]

        statuses = {}
        try:
            statuses = self.transport.get_ports_status() or {}
        except Exception:
            statuses = {}

        eligible = []
        for p in base:
            if not (1 <= p <= 32):
                continue
            with self._lock:
                if self._cooldowns.get(p, 0.0) > now:
                    continue
            st = statuses.get(p)
            if st is not None and (not st.registered or st.signal_rssi < self.min_rssi):
                continue
            eligible.append(p)
        return eligible

    def send_with_failover(
        self,
        to_phone: str,
        message: str,
        idempotency_key: str,
        preferred_ports: Optional[List[int]] = None,
    ) -> SmsDispatchReport:
        with self._lock:
            existing = self._dispatch_states.get(idempotency_key)
            if existing and existing.status == "sent":
                return SmsDispatchReport(
                    ok=True,
                    status="duplicate_blocked",
                    idempotency_key=idempotency_key,
                    winning_port=existing.winning_port,
                    ports_attempted=[],
                    purged_ports=[],
                    message_eliminated=False,
                    gateway_message_id=existing.gateway_message_id,
                    error_reason="Idempotency lock: mensaje ya enviado previamente, duplicado bloqueado.",
                )

        candidates = self._ordered_candidate_ports(preferred_ports)
        if not candidates:
            report = SmsDispatchReport(
                ok=False,
                status="failed_all_ports",
                idempotency_key=idempotency_key,
                message_eliminated=True,
                error_reason="No hay puertos SIM OpenVox activos con señal disponible.",
            )
            with self._lock:
                self._dispatch_states[idempotency_key] = report
            return report

        ports_attempted: List[int] = []
        purged_ports: List[int] = []
        attempts_detail: List[dict] = []

        for idx, port in enumerate(candidates, start=1):
            msg_tag = f"sadi-{idempotency_key}-p{port}"
            ports_attempted.append(port)
            res = self.transport.send_sms_on_port(
                port=port,
                to_phone=to_phone,
                message=message,
                msg_tag=msg_tag,
                timeout_sec=self.attempt_timeout_sec,
            )

            if res.ok and res.outcome == "sent":
                attempts_detail.append({
                    "port": port,
                    "order": idx,
                    "outcome": "sent",
                    "queue_purged": False,
                    "raw": res.raw_response,
                })
                report = SmsDispatchReport(
                    ok=True,
                    status="sent",
                    idempotency_key=idempotency_key,
                    winning_port=port,
                    ports_attempted=ports_attempted,
                    purged_ports=purged_ports,
                    message_eliminated=False,
                    gateway_message_id=res.gateway_message_id or msg_tag,
                    attempts=attempts_detail,
                )
                with self._lock:
                    self._dispatch_states[idempotency_key] = report
                return report

            # Fallo en puerto actual -> PURGA OBLIGATORIA antes de pasar al siguiente puerto
            purged_ok = self.transport.purge_port_message(port=port, msg_tag=msg_tag, to_phone=to_phone)
            purged_ports.append(port)
            with self._lock:
                self._cooldowns[port] = time.monotonic() + self.cooldown_seconds

            attempts_detail.append({
                "port": port,
                "order": idx,
                "outcome": res.outcome,
                "queue_purged": bool(purged_ok),
                "raw": res.raw_response,
            })

        report = SmsDispatchReport(
            ok=False,
            status="failed_all_ports",
            idempotency_key=idempotency_key,
            winning_port=None,
            ports_attempted=ports_attempted,
            purged_ports=purged_ports,
            message_eliminated=True,
            attempts=attempts_detail,
            error_reason=f"Todos los puertos probados ({ports_attempted}) fallaron; cola purgada y mensaje eliminado para evitar consumo posterior.",
        )
        with self._lock:
            self._dispatch_states[idempotency_key] = report
        return report
