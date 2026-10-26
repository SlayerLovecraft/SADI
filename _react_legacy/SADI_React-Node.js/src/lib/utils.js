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
	return msg.includes('jwt') || msg.includes('token') && msg.includes('expired');
}
