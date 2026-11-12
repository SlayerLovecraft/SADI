import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
	return twMerge(clsx(inputs));
}

export function withTimeout(promise, ms, message = 'Tiempo de espera agotado') {
	let timeoutId;
	const timeoutPromise = new Promise((_, reject) => {
		timeoutId = setTimeout(() => reject(new Error(message)), ms);
	});

	return Promise.race([
		Promise.resolve(promise).finally(() => clearTimeout(timeoutId)),
		timeoutPromise,
	]);
}

export function isSupabaseAuthError(error) {
	const status = error?.status ?? error?.statusCode ?? null;
	if (status === 401 || status === 403) return true;
	const msg = String(error?.message || '').toLowerCase();
	return msg.includes('jwt') || (msg.includes('token') && msg.includes('expired'));
}

/**
 * Ejecuta una consulta/mutación a Supabase recuperando automáticamente sesiones JWT vencidas.
 * Si el refresh falla, limpia el token local obsoleto para evitar bloqueos 401 persistentes y reintenta.
 */
export async function runWithSupabaseAuthRecovery(
	supabaseClient,
	queryFn,
	timeoutMs = 15000,
	timeoutMessage = 'Tiempo de espera agotado'
) {
	const exec = () => withTimeout(queryFn(), timeoutMs, timeoutMessage);
	let result = await exec();
	if (result?.error && isSupabaseAuthError(result.error)) {
		const { data: refreshed, error: refreshErr } = await supabaseClient.auth
			.refreshSession()
			.catch(() => ({ data: null, error: true }));
		if (refreshErr || !refreshed?.session) {
			await supabaseClient.auth.signOut({ scope: 'local' }).catch(() => null);
		}
		result = await exec();
	}
	return result;
}
