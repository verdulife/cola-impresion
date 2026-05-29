<script lang="ts">
	interface Props {
		label: string
		active?: boolean
		error?: boolean
		onclick?: () => void
	}

	let { label, active = false, error = false, onclick }: Props = $props()
</script>

<button
	type="button"
	class="config-chip"
	class:active
	class:error
	onclick={onclick}
>
	{label}
</button>

<style>
	.config-chip {
		padding: 6px 12px;
		border-radius: var(--radius-md);
		font-size: var(--text-caption);
		font-weight: 500;
		cursor: pointer;
		transition:
			background-color 0.15s ease,
			color 0.15s ease,
			border-color 0.15s ease;
		border: 1px solid var(--color-border);
		background-color: var(--color-surface-raised);
		color: var(--color-text-secondary);
		white-space: nowrap;
	}

	.config-chip:hover {
		background-color: var(--color-border-subtle);
	}

	.config-chip.active {
		background-color: var(--color-primary);
		color: var(--color-text-on-dark);
		border-color: var(--color-primary);
	}

	.config-chip.error {
		border-color: var(--color-error);
	}
</style>