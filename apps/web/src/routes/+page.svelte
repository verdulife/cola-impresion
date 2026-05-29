<script lang="ts">
	import { onMount } from 'svelte'
	import UploadZone from '$lib/components/UploadZone.svelte'
	import FileCard from '$lib/components/FileCard.svelte'
	import AnonymousBanner from '$lib/components/AnonymousBanner.svelte'
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

	interface User {
		id?: string
		email?: string
		isAnonymous: boolean
		sessionId?: string
	}

	const ANONYMOUS_BANNER_KEY = 'anonymous_banner_shown'

	let files: UploadedFile[] = $state([])
	let showAnonymousBanner = $state(false)
	let isAuthenticated = $state(false)

	onMount(async () => {
		// Check if user is authenticated
		try {
			const res = await fetch('/auth/me')
			if (res.ok) {
				const user: User = await res.json()
				isAuthenticated = !user.isAnonymous

				// Show banner only if anonymous and not shown this session
				if (user.isAnonymous) {
					try {
						const alreadyShown = sessionStorage.getItem(ANONYMOUS_BANNER_KEY)
						showAnonymousBanner = !alreadyShown
					} catch {
						showAnonymousBanner = true
					}
				}
			}
		} catch {
			// Network error, assume anonymous
			isAuthenticated = false
		}
	})

	function handleUpload(file: UploadedFile) {
		files = [file, ...files]
	}

	function handleDelete(id: string) {
		files = files.filter((f) => f.id !== id)
	}

	function handleBannerDismiss() {
		showAnonymousBanner = false
	}
</script>

<div class="page-container">
	{#if showAnonymousBanner}
		<AnonymousBanner onDismiss={handleBannerDismiss} />
	{/if}

	<div class="upload-section">
		<UploadZone onupload={handleUpload} />
	</div>

	<div class="files-section">
		{#if files.length > 0}
			<div class="files-list">
				{#each files as file (file.id)}
					<FileCard {file} ondelete={handleDelete} />
				{/each}
			</div>
		{:else}
			<p class="empty-state">Sube tus archivos para imprimir</p>
		{/if}
	</div>
</div>

<style>
	.page-container {
		display: flex;
		flex-direction: column;
		height: 100vh;
		overflow: hidden;
		padding: 16px;
		gap: 12px;
	}

	.upload-section {
		flex: 0 0 auto;
		max-height: 40vh;
		display: flex;
		flex-direction: column;
	}

	.files-section {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.files-list {
		flex: 1;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.empty-state {
		text-align: center;
		color: var(--color-text-secondary);
		font-size: var(--text-body-small);
		padding: 24px;
	}

	@media (min-width: 768px) {
		.page-container {
			padding: 24px 32px;
			gap: 16px;
		}

		.upload-section {
			max-height: 45vh;
		}
	}
</style>