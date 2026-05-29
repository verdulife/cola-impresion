<script lang="ts">
	import { goto } from '$app/navigation'

	function handleClick() {
		goto('/settings')
	}
</script>

<button
	class="settings-btn"
	onclick={handleClick}
	aria-label="Ajustes de usuario"
	title="Ajustes"
>
	<span class="icon">⚙️</span>
</button>

<style>
	.settings-btn {
		position: fixed;
		top: 16px;
		right: 16px;
		width: 40px;
		height: 40px;
		border-radius: 9999px;
		background-color: var(--color-surface-raised);
		border: 1px solid var(--color-border-subtle);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
		transition: box-shadow 0.15s ease;
		z-index: 50;
	}

	.settings-btn:hover {
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
	}

	.icon {
		font-size: 1.25rem;
		line-height: 1;
	}
</style>