<script lang="ts">
	import UploadZone from '$lib/components/UploadZone.svelte'
	import FileCard from '$lib/components/FileCard.svelte'
	import type { PrintConfig } from '@cola-impresion/shared'

	interface UploadedFile {
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

	let files: UploadedFile[] = $state([])

	function handleUpload(file: UploadedFile) {
		files = [file, ...files]
	}

	function handleDelete(id: string) {
		files = files.filter((f) => f.id !== id)
	}
</script>

<div class="page-container">
	<h1 class="text-h1 text-text-primary">Cola de impresión</h1>
	<UploadZone onupload={handleUpload} />

	{#if files.length > 0}
		<div class="files-list">
			{#each files as file (file.id)}
				<FileCard {file} ondelete={handleDelete} />
			{/each}
		</div>
	{/if}
</div>

<style>
	.page-container {
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.files-list {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
</style>