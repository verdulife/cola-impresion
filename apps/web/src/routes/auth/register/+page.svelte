<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();

	let email = $state('');
	let password = $state('');
	let errors = $state<{ email?: string; password?: string }>({});
	let isSubmitting = $state(false);

	const MIN_PASSWORD_LENGTH = 8;

	function validateEmail(value: string): boolean {
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		return emailRegex.test(value);
	}

	function handleSubmit() {
		errors = {};

		if (!email.trim()) {
			errors.email = 'El email es obligatorio';
		} else if (!validateEmail(email)) {
			errors.email = 'Introduce un email válido';
		}

		if (!password) {
			errors.password = 'La contraseña es obligatoria';
		} else if (password.length < MIN_PASSWORD_LENGTH) {
			errors.password = `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`;
		}

		return Object.keys(errors).length === 0;
	}
</script>

<div class="flex min-h-screen flex-col items-center justify-center px-4 bg-surface">
	<div class="w-full max-w-sm">
		<h1 class="mb-2 text-h1 text-text-primary">Crear cuenta</h1>
		<p class="mb-8 text-body text-text-secondary">
			Regístrate para guardar tu historial de impresiones
		</p>

		<form
			method="POST"
			use:enhance={() => {
				if (!handleSubmit()) {
					return () => {};
				}
				isSubmitting = true;
				return async ({ update }) => {
					await update();
					isSubmitting = false;
				};
			}}
			class="flex flex-col gap-5"
		>
			<div class="flex flex-col gap-1.5">
				<label for="email" class="text-label text-text-primary uppercase tracking-wide">
					Email
				</label>
				<input
					type="email"
					id="email"
					name="email"
					bind:value={email}
					autocomplete="email"
					required
					disabled={isSubmitting}
					class="w-full rounded-md border border-border bg-surface-raised px-3 py-2.5 text-body text-text-primary
					       placeholder:text-text-disabled
					       focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent
					       disabled:opacity-50 disabled:cursor-not-allowed
					       {errors.email ? 'border-error' : ''}"
					aria-invalid={errors.email ? 'true' : undefined}
					aria-describedby={errors.email ? 'email-error' : undefined}
				/>
				{#if errors.email}
					<p id="email-error" class="text-caption text-error">{errors.email}</p>
				{/if}
			</div>

			<div class="flex flex-col gap-1.5">
				<label for="password" class="text-label text-text-primary uppercase tracking-wide">
					Contraseña
				</label>
				<input
					type="password"
					id="password"
					name="password"
					bind:value={password}
					autocomplete="new-password"
					required
					disabled={isSubmitting}
					minlength={MIN_PASSWORD_LENGTH}
					class="w-full rounded-md border border-border bg-surface-raised px-3 py-2.5 text-body text-text-primary
					       placeholder:text-text-disabled
					       focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent
					       disabled:opacity-50 disabled:cursor-not-allowed
					       {errors.password ? 'border-error' : ''}"
					aria-invalid={errors.password ? 'true' : undefined}
					aria-describedby={errors.password ? 'password-error' : undefined}
				/>
				{#if errors.password}
					<p id="password-error" class="text-caption text-error">{errors.password}</p>
				{/if}
				<p class="text-caption text-text-secondary">
					Mínimo {MIN_PASSWORD_LENGTH} caracteres
				</p>
			</div>

			{#if form?.error}
				<p class="text-caption text-error" role="alert">{form.error}</p>
			{/if}

			<button
				type="submit"
				disabled={isSubmitting}
				class="w-full rounded-md bg-accent px-4 py-2.5 text-body font-semibold text-text-on-accent
				       hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2
				       disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
			>
				{#if isSubmitting}
					Creando cuenta...
				{:else}
					Crear cuenta
				{/if}
			</button>
		</form>

		<p class="mt-6 text-center text-body-small text-text-secondary">
			¿Ya tienes cuenta?
			<a href="/auth/login" class="text-accent hover:text-accent-hover hover:underline">
				Iniciar sesión
			</a>
		</p>
	</div>
</div>