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

		try {
			const response = await fetch(`${PUBLIC_API_URL}/auth/login`, {
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
					error: body.message ?? 'Credenciales inválidas'
				});
			}

			// Login exitoso, redirigir a home
			throw redirect(303, '/');
		} catch (error) {
			if (error && typeof error === 'object' && 'status' in error) {
				throw error;
			}
			return fail(500, { error: 'Error al conectar con el servidor' });
		}
	}
};