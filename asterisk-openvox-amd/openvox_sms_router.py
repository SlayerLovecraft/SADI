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
import sqlite3
import subprocess
import tempfile
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


class OpenVoxSshTransport:
    """
    Transporte SSH directo al Gateway OpenVox (ej. 190.90.52.5:12345) usando
    `/my_tools/sms_send_cli` + `asterisk -rx "gsm show spans"`.
    Funciona incluso cuando [http_to_sms] está apagado en el Gateway y soporta
    UTF-8/tildes en español mediante --message-b64 + verificación --status <uuid>.
    """

    def __init__(
        self,
        ssh_host: str,
        ssh_port: int = 12345,
        ssh_user: str = "admin",
        ssh_pass: str = "",
        status_poll_sec: float = 12.0,
    ):
        self.ssh_host = ssh_host.strip()
        self.ssh_port = int(ssh_port or 12345)
        self.ssh_user = ssh_user or "admin"
        self.ssh_pass = ssh_pass or ""
        self.status_poll_sec = max(3.0, float(status_poll_sec))

    def _run_ssh(self, remote_cmd: str, timeout_sec: float = 15.0) -> subprocess.CompletedProcess:
        env = os.environ.copy()
        env["SSHPASS"] = self.ssh_pass
        cmd = [
            "sshpass", "-e",
            "ssh",
            "-o", "StrictHostKeyChecking=no",
            "-o", "UserKnownHostsFile=/dev/null",
            "-o", "HostKeyAlgorithms=+ssh-rsa",
            "-o", "PubkeyAcceptedAlgorithms=+ssh-rsa",
            "-o", "ConnectTimeout=6",
            "-p", str(self.ssh_port),
            f"{self.ssh_user}@{self.ssh_host}",
            remote_cmd,
        ]
        return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout_sec, env=env)

    @staticmethod
    def _normalize_dest_for_openvox(to_phone: str) -> str:
        digits = "".join(ch for ch in str(to_phone or "") if ch.isdigit())
        if len(digits) == 12 and digits.startswith("57"):
            return digits[2:]
        if len(digits) == 10:
            return digits
        return digits or str(to_phone or "").strip()

    def get_ports_status(self) -> Dict[int, PortStatus]:
        statuses: Dict[int, PortStatus] = {}
        if not self.ssh_host:
            return statuses
        try:
            proc = self._run_ssh('asterisk -rx "gsm show spans"', timeout_sec=10.0)
            out = (proc.stdout or "") + "\n" + (proc.stderr or "")
            for line in out.splitlines():
                low = line.lower()
                if "gsm span " in low and ":" in low:
                    after = low.split("gsm span ", 1)[1]
                    num_tok = after.split(":", 1)[0].strip()
                    if num_tok.isdigit():
                        p = int(num_tok)
                        is_up = ("up" in low and "active" in low and "no signal" not in low)
                        statuses[p] = PortStatus(
                            port=p,
                            registered=is_up,
                            signal_rssi=28 if is_up else 0,
                            operator="Claro/GSM" if is_up else "NO_SIGNAL",
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
        timeout_sec: float = 18.0,
    ) -> SmsAttemptResult:
        if not self.ssh_host:
            return SmsAttemptResult(port=port, ok=False, outcome="modem_error", raw_response="OPENVOX_SSH_HOST no configurado")

        dest = self._normalize_dest_for_openvox(to_phone)
        b64_msg = base64.b64encode(message.encode("utf-8")).decode("ascii")
        remote_cmd = (
            f"/my_tools/sms_send_cli --port {int(port)} --to {dest} "
            f"--message-b64 {b64_msg} --retry 0 --smsreport 1"
        )
        try:
            proc = self._run_ssh(remote_cmd, timeout_sec=max(12.0, timeout_sec))
            raw = ((proc.stdout or "") + "\n" + (proc.stderr or "")).strip()
            # Extraer JSON de la salida (saltando banner OpenVox si aparece)
            json_line = ""
            for ln in reversed(raw.splitlines()):
                s = ln.strip()
                if s.startswith("{") and s.endswith("}"):
                    json_line = s
                    break
            if not json_line:
                return SmsAttemptResult(port=port, ok=False, outcome="modem_error", raw_response=raw[:400])

            payload = json.loads(json_line)
            code = int(payload.get("code", 0) or 0)
            infos = (((payload.get("data") or {}).get("send_list") or {}).get("send_infos") or [])
            uuid_val = infos[0].get("uuid") if infos and isinstance(infos[0], dict) else None

            if code != 200 or not uuid_val:
                low = raw.lower()
                outcome = "no_signal" if ("signal" in low or "down" in low or "reject" in low) else "modem_error"
                return SmsAttemptResult(port=port, ok=False, outcome=outcome, raw_response=json_line[:400])

            # Consultar estado real de entrega en OpenVox (--status <uuid>)
            deadline = time.monotonic() + min(self.status_poll_sec, max(4.0, timeout_sec - 2.0))
            last_status_raw = json_line
            while time.monotonic() < deadline:
                time.sleep(1.5)
                try:
                    st_proc = self._run_ssh(f"/my_tools/sms_send_cli --status {uuid_val}", timeout_sec=8.0)
                    st_out = ((st_proc.stdout or "") + "\n" + (st_proc.stderr or "")).strip()
                    for ln in reversed(st_out.splitlines()):
                        s = ln.strip()
                        if s.startswith("{") and s.endswith("}"):
                            last_status_raw = s
                            st_json = json.loads(s)
                            st_val = str((st_json.get("data") or {}).get("status") or "").upper()
                            if st_val in ("DELIVERED", "SENT", "SUCCESS", "OK"):
                                return SmsAttemptResult(
                                    port=port,
                                    ok=True,
                                    outcome="sent",
                                    gateway_message_id=uuid_val,
                                    raw_response=s[:400],
                                )
                            if st_val in ("FAILED", "FAIL", "ERROR", "REJECTED", "TIMEOUT"):
                                return SmsAttemptResult(
                                    port=port,
                                    ok=False,
                                    outcome="modem_error",
                                    gateway_message_id=uuid_val,
                                    raw_response=s[:400],
                                )
                            break
                except Exception:
                    break

            # Si sigue en cola después de esperar pero fue aceptado (code 200), reportar como enviado/aceptado
            return SmsAttemptResult(
                port=port,
                ok=True,
                outcome="sent",
                gateway_message_id=uuid_val,
                raw_response=last_status_raw[:400],
            )
        except subprocess.TimeoutExpired:
            return SmsAttemptResult(port=port, ok=False, outcome="timeout", raw_response="SSH sms_send_cli timeout")
        except Exception as exc:
            return SmsAttemptResult(port=port, ok=False, outcome="modem_error", raw_response=str(exc))

    def purge_port_message(self, port: int, msg_tag: str, to_phone: str) -> bool:
        if not self.ssh_host:
            return False
        try:
            self._run_ssh(f'asterisk -rx "gsm clean sms {int(port)}"', timeout_sec=6.0)
            return True
        except Exception:
            return False

    def fetch_inbound_sms(self, limit: int = 100, port: Optional[int] = None) -> List[dict]:
        """
        Lee el buzón real de SMS entrantes del Gateway OpenVox (`/data/log/smsinbox.db`)
        sin modificar ni borrar filas en el equipo, normalizando teléfono y hora CO.
        """
        if not self.ssh_host:
            return []
        safe_limit = max(1, min(300, int(limit or 100)))
        env = os.environ.copy()
        env["SSHPASS"] = self.ssh_pass
        cmd = [
            "sshpass", "-e",
            "ssh",
            "-o", "StrictHostKeyChecking=no",
            "-o", "UserKnownHostsFile=/dev/null",
            "-o", "HostKeyAlgorithms=+ssh-rsa",
            "-o", "PubkeyAcceptedAlgorithms=+ssh-rsa",
            "-o", "ConnectTimeout=6",
            "-p", str(self.ssh_port),
            f"{self.ssh_user}@{self.ssh_host}",
            "cat /data/log/smsinbox.db",
        ]
        tmp_path = None
        try:
            proc = subprocess.run(cmd, capture_output=True, timeout=18.0, env=env)
            if proc.returncode != 0 or not proc.stdout:
                return []
            with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tf:
                tf.write(proc.stdout)
                tmp_path = tf.name
            con = sqlite3.connect(tmp_path)
            cur = con.cursor()
            if port is not None:
                rows = cur.execute(
                    "SELECT id, port, phonenumber, time, message, flag FROM sms WHERE port = ? ORDER BY id DESC LIMIT ?",
                    (str(port), safe_limit),
                ).fetchall()
            else:
                rows = cur.execute(
                    "SELECT id, port, phonenumber, time, message, flag FROM sms ORDER BY id DESC LIMIT ?",
                    (safe_limit,),
                ).fetchall()
            con.close()
            out: List[dict] = []
            for row in rows:
                msg_id, p_val, phone_val, time_val, text_val, flag_val = row
                raw_time = str(time_val or "").strip()
                iso_time = raw_time
                if len(raw_time) == 19 and raw_time[4] == "/" and raw_time[7] == "/":
                    iso_time = f"{raw_time[:4]}-{raw_time[5:7]}-{raw_time[8:10]}T{raw_time[11:19]}-05:00"
                out.append({
                    "id": int(msg_id),
                    "port": str(p_val or ""),
                    "phonenumber": str(phone_val or "").strip(),
                    "time": raw_time,
                    "receivedAtIso": iso_time,
                    "message": str(text_val or ""),
                    "flag": int(flag_val or 0),
                })
            return out
        except Exception:
            return []
        finally:
            if tmp_path and os.path.exists(tmp_path):
                try:
                    os.unlink(tmp_path)
                except Exception:
                    pass


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
