import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const PUBLIC_API_URL = process.env.PUBLIC_API_URL || 'http://localhost:3001';

export const load: PageServerLoad = async () => {
	return {};
};

export const actions: Actions = {
	default: async ({ request, fetch }) => {
		const data = await request.formData();
		const email = data.get('email')?.toString().trim() ?? '';
		const password = data.get('password')?.toString() ?? '';

		// Validación básica en servidor
		if (!email || !password) {
			return fail(400, { error: 'Email y contraseña son obligatorios' });
		}

		if (password.length < 8) {
			return fail(400, { error: 'La contraseña debe tener al menos 8 caracteres' });
		}

		try {
			const response = await fetch(`${PUBLIC_API_URL}/auth/register`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ email, password }),
				credentials: 'include'
			});

			if (!response.ok) {
				const body = await response.json();
				return fail(response.status, {
					error: body.message ?? 'No se pudo crear la cuenta'
				});
			}

			// Registro exitoso, redirigir a home
			throw redirect(303, '/');
		} catch (error) {
			if (error && typeof error === 'object' && 'status' in error) {
				throw error;
			}
			return fail(500, { error: 'Error al conectar con el servidor' });
		}
	}
};