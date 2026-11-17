from http.server import BaseHTTPRequestHandler, HTTPServer
import json
import math
import threading
import unittest

from early_media_detector import (
    EarlyMediaAnalyzer,
    EarlyMediaDecision,
    cancel_ari_channel_and_notify,
    classify_colombian_phrase,
    parse_rtp_packet,
)


def linear_to_ulaw_byte(sample: int) -> int:
    """Codificador simple PCM16 -> G.711 mu-law para pruebas unitarias de RTP."""
    BIAS = 0x84
    CLIP = 32635
    sign = 0x80 if sample < 0 else 0
    if sample < 0:
        sample = -sample
    if sample > CLIP:
        sample = CLIP
    sample += BIAS
    exponent = 7
    exp_mask = 0x4000
    while exponent > 0 and not (sample & exp_mask):
        exponent -= 1
        exp_mask >>= 1
    mantissa = (sample >> (exponent + 3)) & 0x0F
    return (~(sign | (exponent << 4) | mantissa)) & 0xFF


def make_sine_ulaw_frame(freq_hz: float, amp: int = 8000, samples: int = 160, rate: int = 8000) -> bytes:
    out = bytearray(samples)
    for n in range(samples):
        val = int(amp * math.sin(2.0 * math.pi * freq_hz * n / rate))
        out[n] = linear_to_ulaw_byte(val)
    return bytes(out)


def make_modulated_speech_ulaw_frame(frame_idx: int, samples: int = 160, rate: int = 8000) -> bytes:
    # Mezcla multi-frecuencia simulando formantes de habla (no tono puro)
    out = bytearray(samples)
    base = 220.0 + ((frame_idx * 37) % 180)
    for n in range(samples):
        v = (
            4500 * math.sin(2.0 * math.pi * base * n / rate)
            + 3000 * math.sin(2.0 * math.pi * (base * 2.35) * n / rate)
            + 2000 * math.sin(2.0 * math.pi * (base * 3.8) * n / rate)
        )
        out[n] = linear_to_ulaw_byte(int(v))
    return bytes(out)


def make_silence_ulaw_frame(samples: int = 160) -> bytes:
    return bytes([0xFF] * samples)


class TestEarlyMediaDetector(unittest.TestCase):
    def test_colombian_ringback_cadence_does_not_false_trigger(self):
        analyzer = EarlyMediaAnalyzer(ring_timeout_sec=19.0)
        tone_425 = make_sine_ulaw_frame(425.0)
        silence = make_silence_ulaw_frame()

        # Simular 2 ciclos completos de ringback colombiano (1.0s ON / 3.0s OFF)
        for cycle in range(2):
            for i in range(50):  # 1.0s ON
                d = analyzer.process_ulaw_frame(tone_425, elapsed_sec=cycle * 4.0 + i * 0.02)
                self.assertFalse(d.should_cancel)
            for j in range(150):  # 3.0s OFF
                d = analyzer.process_ulaw_frame(silence, elapsed_sec=cycle * 4.0 + 1.0 + j * 0.02)
                self.assertFalse(d.should_cancel)

    def test_voicemail_beep_950hz_in_sip183_cancels_pre_answer(self):
        analyzer = EarlyMediaAnalyzer(ring_timeout_sec=19.0)
        beep_950 = make_sine_ulaw_frame(950.0)
        triggered = None
        for i in range(25):  # up to 500ms
            d = analyzer.process_ulaw_frame(beep_950, elapsed_sec=i * 0.02)
            if d.should_cancel:
                triggered = d
                break
        self.assertIsNotNone(triggered)
        self.assertEqual(triggered.phase, "pre_answer_sip_183")
        self.assertEqual(triggered.reason, "sip-183-early-media-beep")

    def test_continuous_carrier_speech_in_sip183_cancels_pre_answer(self):
        analyzer = EarlyMediaAnalyzer(ring_timeout_sec=19.0, speech_cutoff_ms=1650)
        triggered = None
        for i in range(100):  # up to 2.0s continuous voice
            frame = make_modulated_speech_ulaw_frame(i)
            d = analyzer.process_ulaw_frame(frame, elapsed_sec=i * 0.02)
            if d.should_cancel:
                triggered = d
                break
        self.assertIsNotNone(triggered)
        self.assertEqual(triggered.phase, "pre_answer_sip_183")
        self.assertEqual(triggered.reason, "sip-183-early-media-voicemail-speech")

    def test_ring_timeout_before_carrier_voicemail_cancels(self):
        analyzer = EarlyMediaAnalyzer(ring_timeout_sec=19.0)
        d = analyzer.process_ulaw_frame(make_silence_ulaw_frame(), elapsed_sec=19.1)
        self.assertTrue(d.should_cancel)
        self.assertEqual(d.phase, "ring_timeout_before_200ok")
        self.assertEqual(d.sip_code, 487)

    def test_colombian_phrase_classifier(self):
        self.assertIsNotNone(
            classify_colombian_phrase("Claro te informa: su llamada está siendo transferida al correo de voz")
        )
        self.assertIsNone(classify_colombian_phrase("Aló, buenos días, sí claro yo confirmo mi cita"))

    def test_rtp_parser_and_webhook_notification(self):
        header = bytes([0x80, 0x00, 0x00, 0x01, 0, 0, 0, 160, 1, 2, 3, 4])
        payload = make_sine_ulaw_frame(425.0)
        self.assertEqual(parse_rtp_packet(header + payload), payload)

        received = []

        class MockServer(BaseHTTPRequestHandler):
            def do_POST(self):
                length = int(self.headers.get("Content-Length", "0"))
                received.append(json.loads(self.rfile.read(length).decode("utf-8")))
                self.send_response(200)
                self.end_headers()
                self.wfile.write(b'{"ok":true}')

            def log_message(self, *args):
                pass

        srv = HTTPServer(("127.0.0.1", 0), MockServer)
        t = threading.Thread(target=srv.serve_forever, daemon=True)
        t.start()
        try:
            res = cancel_ari_channel_and_notify(
                ari_base_url="",
                ari_user="",
                ari_pass="",
                channel_id="chan-123",
                webhook_url=f"http://127.0.0.1:{srv.server_port}/vapi-webhook",
                webhook_secret="test-secret",
                call_meta={"patientId": "pat-1", "phoneNumber": "+573001112233"},
                decision=EarlyMediaDecision(
                    should_cancel=True,
                    reason="sip-183-early-media-voicemail-speech",
                    phase="pre_answer_sip_183",
                    sip_code=183,
                    confidence=0.95,
                ),
            )
            self.assertTrue(res["webhook_notified"])
            self.assertEqual(len(received), 1)
            self.assertEqual(received[0]["phase"], "pre_answer_sip_183")
            self.assertEqual(received[0]["sipCode"], 183)
        finally:
            srv.shutdown()
            srv.server_close()


if __name__ == "__main__":
    unittest.main()

