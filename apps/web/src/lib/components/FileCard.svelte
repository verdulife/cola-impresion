<script lang="ts">
	import type { PrintConfig } from '@cola-impresion/shared'
	import ConfigChip from './ConfigChip.svelte'
	import PrintConfigPanel from './PrintConfigPanel.svelte'
	import { PUBLIC_API_URL } from '$env/static/public'

	export interface UploadedFile {
		id: string
		name: string
		mimeType: string
		sizeBytes: number
		pageCount: number
		status: string
		uploadedAt: number
		expiresAt: number
		config: PrintConfig
	}

	interface Props {
		file: UploadedFile
		ondelete?: (id: string) => void
	}

	let { file, ondelete }: Props = $props()

	let expanded = $state(false)

	const PAPER_LABELS: Record<string, string> = {
		'normal-90': 'Normal 90gr',
		'satin-135': 'Satinado 135gr',
		'matte-120': 'Mate 120gr',
		'satin-300': 'Satinado 300gr',
		'matte-300': 'Mate 300gr',
		'adhesive-matte': 'Adhesivo Mate',
		'adhesive-gloss': 'Adhesivo Brillante',
		'textured-300': 'Texturizado 300gr'
	}

	const SIZE_LABELS: Record<string, string> = {
		A4: 'A4',
		A3: 'A3',
		A5: 'A5',
		A6: 'A6'
	}

	const COLOR_LABELS: Record<string, string> = {
		bw: 'B/N',
		color: 'Color'
	}

	const SIDES_LABELS: Record<string, string> = {
		single: '1 cara',
		double: '2 caras'
	}

	function getFileIcon(mimeType: string): string {
		if (mimeType === 'application/pdf') return '📄'
		if (mimeType.startsWith('image/')) return '🖼️'
		return '📄'
	}

	function truncateName(name: string, maxLength: number = 30): string {
		if (name.length <= maxLength) return name
		const ext = name.split('.').pop() ?? ''
		const baseName = name.slice(0, name.length - ext.length - 1)
		const truncatedBase = baseName.slice(0, maxLength - ext.length - 4)
		return `${truncatedBase}...${ext}`
	}

	function getActiveChips(config: PrintConfig): { label: string }[] {
		return [
			{ label: SIZE_LABELS[config.size] ?? config.size },
			{ label: COLOR_LABELS[config.color] ?? config.color },
			{ label: SIDES_LABELS[config.sides] ?? config.sides },
			{ label: PAPER_LABELS[config.paper] ?? config.paper }
		]
	}

	function toggleExpand() {
		expanded = !expanded
	}

	async function handleDelete(e: Event) {
		e.stopPropagation()
		try {
			await fetch(`${PUBLIC_API_URL}/files/${file.id}`, {
				method: 'DELETE'
			})
			ondelete?.(file.id)
		} catch {
			// Silently fail - the file will remain in the list
		}
	}

	let activeChips = $derived(getActiveChips(file.config))
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="file-card" class:expanded onclick={toggleExpand}>
	<button
		type="button"
		class="delete-btn"
		onclick={handleDelete}
		aria-label="Eliminar archivo"
	>
		✕
	</button>

	<div class="file-header">
		<span class="file-icon">{getFileIcon(file.mimeType)}</span>
		<span class="file-name">{truncateName(file.name)}</span>
	</div>

	<div class="file-chips">
		{#each activeChips as chip}
			<ConfigChip label={chip.label} active={true} />
		{/each}
	</div>

	{#if expanded}
		<div class="config-panel-wrapper" onclick={(e) => e.stopPropagation()}>
			<PrintConfigPanel
				fileId={file.id}
				config={file.config}
				onchange={(newConfig) => {
					file.config = newConfig
				}}
			/>
		</div>
	{/if}
</div>

<style>
	.file-card {
		position: relative;
		background-color: var(--color-surface);
		border: 1px solid var(--color-border-subtle);
		border-radius: var(--radius-lg);
		padding: 16px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
		cursor: pointer;
		transition:
			box-shadow 0.15s ease,
			border-color 0.15s ease;
	}

	.file-card:hover {
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
	}

	.file-card.expanded {
		border-color: var(--color-border);
	}

	.delete-btn {
		position: absolute;
		top: 12px;
		right: 12px;
		width: 24px;
		height: 24px;
		border: none;
		background: transparent;
		color: var(--color-text-secondary);
		cursor: pointer;
		border-radius: var(--radius-sm);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 12px;
		transition:
			background-color 0.15s ease,
			color 0.15s ease;
	}

	.delete-btn:hover {
		background-color: var(--color-error-surface);
		color: var(--color-error);
	}

	.file-header {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 12px;
		padding-right: 32px;
	}

	.file-icon {
		font-size: 1.5rem;
		line-height: 1;
	}

	.file-name {
		font-size: var(--text-body-small);
		font-weight: 500;
		color: var(--color-text-primary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.file-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.config-panel-wrapper {
		margin-top: 16px;
	}
</style>