import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { spawnSync } from 'child_process'

function localEmailDevPlugin(env) {
  return {
    name: 'sadi-local-email-dev-middleware',
    configureServer(server) {
      server.middlewares.use('/api/local-email-status', (req, res) => {
        const resendKey = (env.LOCAL_RESEND_API_KEY || '').trim();
        const smtpHost = (env.LOCAL_SMTP_HOST || '').trim();
        const smtpUser = (env.LOCAL_SMTP_USER || '').trim();
        const smtpPass = (env.LOCAL_SMTP_PASS || '').trim();
        const configured = Boolean(resendKey || (smtpHost && smtpUser && smtpPass));
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          ok: true,
          configured,
          provider: resendKey ? 'resend_local' : (smtpHost && smtpUser && smtpPass ? 'smtp_local' : null),
          smtpHost: smtpHost || null,
        }));
      });

      server.middlewares.use('/api/local-send-email', async (req, res) => {
        if (req.method === 'OPTIONS') {
          res.statusCode = 200;
          res.end('ok');
          return;
        }
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: false, error: 'Method not allowed' }));
          return;
        }
        const chunks = [];
        for await (const ch of req) chunks.push(ch);
        let body = {};
        try {
          body = JSON.parse(Buffer.concat(chunks).toString('utf-8') || '{}');
        } catch {
          body = {};
        }

        const recipients = Array.isArray(body.recipients) ? body.recipients : [];
        const resendKey = (env.LOCAL_RESEND_API_KEY || '').trim();
        const smtpHost = (env.LOCAL_SMTP_HOST || '').trim();
        const smtpPort = Number(env.LOCAL_SMTP_PORT || 587);
        const smtpUser = (env.LOCAL_SMTP_USER || '').trim();
        const smtpPass = (env.LOCAL_SMTP_PASS || '').trim();
        const smtpFrom = (env.LOCAL_SMTP_FROM || smtpUser || 'SADI Salud <onboarding@resend.dev>').trim();

        res.setHeader('Content-Type', 'application/json');
        if (!resendKey && (!smtpHost || !smtpUser || !smtpPass)) {
          res.statusCode = 200;
          res.end(JSON.stringify({
            success: false,
            missingConfig: true,
            enviados: 0,
            fallidos: recipients.length,
            omitidos: 0,
            error: 'Configura LOCAL_SMTP_HOST/LOCAL_SMTP_USER/LOCAL_SMTP_PASS o LOCAL_RESEND_API_KEY en .env.local para envío local de correos.',
            results: [],
          }));
          return;
        }

        const campName = String(body.campaignName || 'Campaña Res. 3280').trim();
        const sede = String(body.sede || 'Hospital Central SADI').trim();
        const fecha = String(body.fecha || new Date().toISOString().slice(0, 10)).trim();

        let enviados = 0;
        let fallidos = 0;
        let omitidos = 0;
        const results = [];
        for (const rec of recipients) {
          const toEmail = String(rec?.email || '').trim();
          const name = String(rec?.name || rec?.nombre || 'Paciente').trim();
          const firstName = name.split(/\s+/)[0] || 'Paciente';
          if (!toEmail || !toEmail.includes('@')) {
            omitidos += 1;
            results.push({ name, ok: false, status: 'skipped_no_email' });
            continue;
          }
          const subject = String(body.subject || `SADI · ${campName}`)
            .replaceAll('{paciente}', name)
            .replaceAll('{nombre}', firstName)
            .replaceAll('{campana}', campName)
            .replaceAll('{sede}', sede)
            .replaceAll('{fecha}', fecha);
          const textBody = String(body.textBody || body.message || '')
            .replaceAll('{paciente}', name)
            .replaceAll('{nombre}', firstName)
            .replaceAll('{campana}', campName)
            .replaceAll('{sede}', sede)
            .replaceAll('{fecha}', fecha);

          if (resendKey) {
            try {
              const r = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ from: smtpFrom, to: [toEmail], subject, text: textBody }),
              });
              const d = await r.json().catch(() => ({}));
              if (r.ok) {
                enviados += 1;
                results.push({ name, email: toEmail, ok: true, status: 'sent', provider: 'resend_local', messageId: d.id });
              } else {
                fallidos += 1;
                results.push({ name, email: toEmail, ok: false, status: 'failed', error: d?.message || `HTTP ${r.status}` });
              }
            } catch (e) {
              fallidos += 1;
              results.push({ name, email: toEmail, ok: false, status: 'failed', error: String(e?.message || e) });
            }
          } else {
            const pyScript = `import json, sys, ssl, smtplib
from email.message import EmailMessage
p = json.loads(sys.stdin.read())
m = EmailMessage()
m['Subject'] = p['subject']
m['From'] = p['from']
m['To'] = p['to']
m.set_content(p['text'])
ctx = ssl.create_default_context()
if int(p['port']) == 465:
    with smtplib.SMTP_SSL(p['host'], int(p['port']), timeout=15, context=ctx) as s:
        s.login(p['user'], p['pass']); s.send_message(m)
else:
    with smtplib.SMTP(p['host'], int(p['port']), timeout=15) as s:
        s.ehlo(); s.starttls(context=ctx); s.ehlo(); s.login(p['user'], p['pass']); s.send_message(m)
print('OK')`;
            const proc = spawnSync('python', ['-c', pyScript], {
              input: JSON.stringify({ host: smtpHost, port: smtpPort, user: smtpUser, pass: smtpPass, from: smtpFrom, to: toEmail, subject, text: textBody }),
              encoding: 'utf-8',
              timeout: 20000,
            });
            if (proc.status === 0 && (proc.stdout || '').includes('OK')) {
              enviados += 1;
              results.push({ name, email: toEmail, ok: true, status: 'sent', provider: 'smtp_local' });
            } else {
              fallidos += 1;
              results.push({ name, email: toEmail, ok: false, status: 'failed', error: (proc.stderr || proc.stdout || 'SMTP error').trim().slice(0, 260) });
            }
          }
        }
        res.statusCode = 200;
        res.end(JSON.stringify({ success: enviados > 0, missingConfig: false, enviados, fallidos, omitidos, results }));
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
  plugins: [react(), localEmailDevPlugin(env)],
  resolve: {
    extensions: ['.js', '.jsx', '.ts', '.tsx'],
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '::',
    port: 3000,
    strictPort: false,
  },
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            const normalized = id.replace(/\\/g, '/');
            if (normalized.includes('/react/') || normalized.includes('/react-dom/') || normalized.includes('/scheduler/')) {
              return 'vendor-react-core';
            }
            if (normalized.includes('react-router') || normalized.includes('react-router-dom')) {
              return 'vendor-router';
            }
            if (normalized.includes('lucide-react')) {
              return 'vendor-icons';
            }
            if (normalized.includes('framer-motion')) {
              return 'vendor-motion';
            }
            if (normalized.includes('jspdf') || normalized.includes('html2canvas')) {
              return 'vendor-pdf';
            }
            if (normalized.includes('xlsx')) {
              return 'vendor-xlsx';
            }
            if (normalized.includes('@supabase') || normalized.includes('axios')) {
              return 'vendor-supabase';
            }
            if (normalized.includes('@radix-ui')) {
              return 'vendor-radix';
            }
          }
        }
      }
    }
  },
  optimizeDeps: {
    include: ['@supabase/supabase-js']
  }
  };
})
