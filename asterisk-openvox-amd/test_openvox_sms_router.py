import unittest
from openvox_sms_router import OpenVoxSmsRouter, PortStatus, SmsAttemptResult


class FakeOpenVoxTransport:
    def __init__(self, statuses, outcomes_by_port):
        self.statuses = statuses
        self.outcomes_by_port = outcomes_by_port
        self.sent_calls = []
        self.purged_calls = []

    def get_ports_status(self):
        return self.statuses

    def send_sms_on_port(self, port, to_phone, message, msg_tag, timeout_sec):
        self.sent_calls.append((port, to_phone, msg_tag))
        outcome = self.outcomes_by_port.get(port, "modem_error")
        if outcome == "sent":
            return SmsAttemptResult(port=port, ok=True, outcome="sent", gateway_message_id=f"gw-{port}", raw_response="OK")
        return SmsAttemptResult(port=port, ok=False, outcome=outcome, raw_response=f"ERR:{outcome}")

    def purge_port_message(self, port, msg_tag, to_phone):
        self.purged_calls.append((port, msg_tag, to_phone))
        return True


class TestOpenVoxSmsRouter(unittest.TestCase):
    def test_port_x_fails_purges_and_succeeds_on_port_y_without_touching_z(self):
        statuses = {
            1: PortStatus(port=1, registered=True, signal_rssi=18),  # dice señal ok pero falla al lanzar
            2: PortStatus(port=2, registered=True, signal_rssi=22),  # éxito
            3: PortStatus(port=3, registered=True, signal_rssi=25),  # no debe usarse
        }
        transport = FakeOpenVoxTransport(statuses, {1: "no_signal", 2: "sent", 3: "sent"})
        router = OpenVoxSmsRouter(transport=transport, ports=[1, 2, 3])

        res = router.send_with_failover("+573001112233", "Recordatorio SADI", idempotency_key="msg-001", preferred_ports=[1, 2, 3])

        self.assertTrue(res.ok)
        self.assertEqual(res.status, "sent")
        self.assertEqual(res.winning_port, 2)
        self.assertEqual(res.ports_attempted, [1, 2])
        self.assertEqual(res.purged_ports, [1])
        self.assertFalse(res.message_eliminated)
        self.assertEqual(len(transport.purged_calls), 1)
        self.assertEqual(transport.purged_calls[0][0], 1)

        # Un segundo llamado con el mismo idempotency_key jamás vuelve a enviar por ninguna SIM
        dup = router.send_with_failover("+573001112233", "Recordatorio SADI", idempotency_key="msg-001", preferred_ports=[1, 2, 3])
        self.assertEqual(dup.status, "duplicate_blocked")
        self.assertEqual(len(transport.sent_calls), 2)  # Siguen solo los 2 intentos originales (puerto 1 y puerto 2)

    def test_all_ports_fail_purges_every_attempt_and_eliminates_message(self):
        statuses = {
            4: PortStatus(port=4, registered=True, signal_rssi=12),
            5: PortStatus(port=5, registered=False, signal_rssi=0),  # descartado de entrada por RSSI=0
            6: PortStatus(port=6, registered=True, signal_rssi=14),
        }
        transport = FakeOpenVoxTransport(statuses, {4: "timeout", 6: "modem_error"})
        router = OpenVoxSmsRouter(transport=transport, ports=[4, 5, 6])

        res = router.send_with_failover("+573009998877", "Cita Res 3280", idempotency_key="msg-002", preferred_ports=[4, 5, 6])

        self.assertFalse(res.ok)
        self.assertEqual(res.status, "failed_all_ports")
        self.assertTrue(res.message_eliminated)
        self.assertEqual(res.ports_attempted, [4, 6])
        self.assertEqual(res.purged_ports, [4, 6])
        self.assertEqual([c[0] for c in transport.purged_calls], [4, 6])


if __name__ == "__main__":
    unittest.main()
