<script lang="ts">
	import type { PrintConfig, PrintSize, PrintColor, PrintSides, PrintPaper } from '@cola-impresion/shared'
	import ConfigChip from './ConfigChip.svelte'
	import { PUBLIC_API_URL } from '$env/static/public'

	interface Props {
		fileId: string
		config: PrintConfig
		onchange?: (config: PrintConfig) => void
	}

	let { fileId, config, onchange }: Props = $props()

	// Track which chip has an error (failed PATCH request)
	let errorChip: string | null = $state(null)

	const sizes: { value: PrintSize; label: string }[] = [
		{ value: 'A4', label: 'A4' },
		{ value: 'A3', label: 'A3' },
		{ value: 'A5', label: 'A5' },
		{ value: 'A6', label: 'A6' }
	]

	const colors: { value: PrintColor; label: string }[] = [
		{ value: 'bw', label: 'B/N' },
		{ value: 'color', label: 'Color' }
	]

	const sides: { value: PrintSides; label: string }[] = [
		{ value: 'single', label: '1 cara' },
		{ value: 'double', label: '2 caras' }
	]

	const papers: { value: PrintPaper; label: string }[] = [
		{ value: 'normal-90', label: 'Normal 90gr' },
		{ value: 'satin-135', label: 'Satinado 135gr' },
		{ value: 'matte-120', label: 'Mate 120gr' },
		{ value: 'satin-300', label: 'Satinado 300gr' },
		{ value: 'matte-300', label: 'Mate 300gr' },
		{ value: 'adhesive-matte', label: 'Adhesivo Mate' },
		{ value: 'adhesive-gloss', label: 'Adhesivo Brillante' },
		{ value: 'textured-300', label: 'Texturizado 300gr' }
	]

	async function selectOption<K extends keyof PrintConfig>(
		key: K,
		value: PrintConfig[K]
	) {
		const previousConfig = { ...config }
		const newConfig = { ...config, [key]: value }

		// Optimistic update
		onchange?.(newConfig)

		// Clear any previous error for this chip
		const chipId = `${key}-${value}`
		errorChip = null

		try {
			const response = await fetch(`${PUBLIC_API_URL}/files/${fileId}/config`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ [key]: value })
			})

			if (!response.ok) {
				throw new Error('Failed to update config')
			}
		} catch {
			// Revert on error
			errorChip = chipId
			onchange?.(previousConfig)
		}
	}

	function isActive(key: keyof PrintConfig, value: string): boolean {
		return config[key] === value
	}

	function hasError(key: keyof PrintConfig, value: string): boolean {
		return errorChip === `${key}-${value}`
	}
</script>

<div class="config-panel">
	<div class="config-group">
		<span class="group-label">Tamaño</span>
		<div class="chips-row">
			{#each sizes as { value, label }}
				<ConfigChip
					{label}
					active={isActive('size', value)}
					error={hasError('size', value)}
					onclick={() => selectOption('size', value)}
				/>
			{/each}
		</div>
	</div>

	<div class="config-group">
		<span class="group-label">Color</span>
		<div class="chips-row">
			{#each colors as { value, label }}
				<ConfigChip
					{label}
					active={isActive('color', value)}
					error={hasError('color', value)}
					onclick={() => selectOption('color', value)}
				/>
			{/each}
		</div>
	</div>

	<div class="config-group">
		<span class="group-label">Caras</span>
		<div class="chips-row">
			{#each sides as { value, label }}
				<ConfigChip
					{label}
					active={isActive('sides', value)}
					error={hasError('sides', value)}
					onclick={() => selectOption('sides', value)}
				/>
			{/each}
		</div>
	</div>

	<div class="config-group">
		<span class="group-label">Papel</span>
		<div class="chips-row scrollable">
			{#each papers as { value, label }}
				<ConfigChip
					{label}
					active={isActive('paper', value)}
					error={hasError('paper', value)}
					onclick={() => selectOption('paper', value)}
				/>
			{/each}
		</div>
	</div>
</div>

<style>
	.config-panel {
		background-color: var(--color-surface-sunken);
		padding: 16px;
		border-radius: var(--radius-md);
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.config-group {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.group-label {
		font-size: var(--text-label);
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--color-text-secondary);
	}

	.chips-row {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.chips-row.scrollable {
		overflow-x: auto;
		flex-wrap: nowrap;
		padding-bottom: 4px;
		scrollbar-width: thin;
	}

	.chips-row.scrollable::-webkit-scrollbar {
		height: 4px;
	}

	.chips-row.scrollable::-webkit-scrollbar-track {
		background: var(--color-border-subtle);
		border-radius: var(--radius-full);
	}

	.chips-row.scrollable::-webkit-scrollbar-thumb {
		background: var(--color-border);
		border-radius: var(--radius-full);
	}
</style>