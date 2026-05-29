<script lang="ts">
	import { goto } from '$app/navigation'

	interface Props {
		onDismiss: () => void
	}

	let { onDismiss }: Props = $props()

	const ANONYMOUS_BANNER_KEY = 'anonymous_banner_shown'

	function handleCreateAccount() {
		goto('/auth/register')
	}

	function handleContinue() {
		try {
			sessionStorage.setItem(ANONYMOUS_BANNER_KEY, 'true')
		} catch {
			// sessionStorage no disponible
		}
		onDismiss()
	}
</script>

<div class="banner" role="alert">
	<p class="message">
		Estás en modo anónimo. Tus archivos se perderán si cierras el navegador.
	</p>
	<div class="actions">
		<button class="btn-primary" onclick={handleCreateAccount}>
			Crear cuenta
		</button>
		<button class="btn-ghost" onclick={handleContinue}>
			Continuar sin cuenta
		</button>
	</div>
</div>

<style>
	.banner {
		background-color: var(--color-warning-surface);
		color: var(--color-warning);
		border-radius: var(--radius-lg);
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.message {
		font-size: var(--text-body-small);
		line-height: 1.5;
		margin: 0;
	}

	.actions {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}

	.btn-primary {
		background-color: var(--color-accent);
		color: var(--color-text-on-accent);
		border: none;
		border-radius: var(--radius-md);
		padding: 8px 16px;
		font-size: var(--text-body-small);
		font-weight: 600;
		cursor: pointer;
		transition: background-color 0.15s ease;
	}

	.btn-primary:hover {
		background-color: var(--color-accent-hover);
	}

	.btn-ghost {
		background-color: transparent;
		color: var(--color-warning);
		border: 1px solid var(--color-warning);
		border-radius: var(--radius-md);
		padding: 8px 16px;
		font-size: var(--text-body-small);
		font-weight: 600;
		cursor: pointer;
		transition: background-color 0.15s ease;
	}

	.btn-ghost:hover {
		background-color: rgba(231, 111, 81, 0.1);
	}
</style>