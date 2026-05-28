<script lang="ts">
	import type { PrintConfig } from '@cola-impresion/shared';
	import { PUBLIC_API_URL } from '$env/static/public';

	const ACCEPTED_TYPES = ['.pdf', '.jpg', '.jpeg', '.png', '.tiff', '.tif'];
	const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

	type UploadState = 'idle' | 'dragover' | 'uploading' | 'error';

	let state: UploadState = $state('idle');
	let errorMessage: string = $state('');
	let progress: number = $state(0);
	let fileInput: HTMLInputElement;

	interface UploadedFile {
		id: string;
		name: string;
		mimeType: string;
		sizeBytes: number;
		pageCount: number;
		status: string;
		uploadedAt: number;
		expiresAt: number;
		config: PrintConfig;
	}

	interface Props {
		onupload?: (file: UploadedFile) => void;
	}

	let { onupload }: Props = $props();

	function isValidType(file: File): boolean {
		const ext = '.' + file.name.split('.').pop()?.toLowerCase();
		return ACCEPTED_TYPES.includes(ext);
	}

	function isValidSize(file: File): boolean {
		return file.size <= MAX_SIZE_BYTES;
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		if (state !== 'error') {
			state = 'dragover';
		}
	}

	function handleDragLeave(e: DragEvent) {
		e.preventDefault();
		if (state === 'dragover') {
			state = 'idle';
			errorMessage = '';
		}
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		const files = e.dataTransfer?.files;
		if (files && files.length > 0) {
			processFile(files[0]);
		} else {
			state = 'idle';
		}
	}

	function handleClick() {
		if (state === 'idle' || state === 'error') {
			fileInput?.click();
		}
	}

	function handleFileSelect(e: Event) {
		const target = e.target as HTMLInputElement;
		const files = target.files;
		if (files && files.length > 0) {
			processFile(files[0]);
		}
		target.value = '';
	}

	async function processFile(file: File) {
		if (!isValidType(file)) {
			state = 'error';
			errorMessage = 'Solo se aceptan PDF, JPG, PNG y TIFF';
			return;
		}

		if (!isValidSize(file)) {
			state = 'error';
			errorMessage = 'El archivo supera el límite de 50MB';
			return;
		}

		state = 'uploading';
		progress = 0;
		errorMessage = '';

		try {
			const uploadedFile = await uploadFile(file);
			onupload?.(uploadedFile);
			state = 'idle';
			progress = 0;
		} catch (err) {
			state = 'error';
			errorMessage = err instanceof Error ? err.message : 'Error al subir el archivo';
			progress = 0;
		}
	}

	function uploadFile(file: File): Promise<UploadedFile> {
		return new Promise((resolve, reject) => {
			const xhr = new XMLHttpRequest();
			const formData = new FormData();
			formData.append('file', file);

			xhr.upload.addEventListener('progress', (e) => {
				if (e.lengthComputable) {
					progress = Math.round((e.loaded / e.total) * 100);
				}
			});

			xhr.addEventListener('load', () => {
				if (xhr.status >= 200 && xhr.status < 300) {
					try {
						const response = JSON.parse(xhr.responseText);
						resolve(response.file);
					} catch {
						reject(new Error('Respuesta inválida del servidor'));
					}
				} else {
					try {
						const error = JSON.parse(xhr.responseText);
						reject(new Error(error.message || 'Error al subir el archivo'));
					} catch {
						reject(new Error(`Error ${xhr.status}: ${xhr.statusText}`));
					}
				}
			});

			xhr.addEventListener('error', () => {
				reject(new Error('Error de conexión'));
			});

			xhr.addEventListener('abort', () => {
				reject(new Error('Subida cancelada'));
			});

			xhr.open('POST', `${PUBLIC_API_URL}/files/upload`);
			xhr.send(formData);
		});
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="upload-zone"
	class:dragover={state === 'dragover'}
	class:uploading={state === 'uploading'}
	class:error={state === 'error'}
	onclick={handleClick}
	ondragover={handleDragOver}
	ondragleave={handleDragLeave}
	ondrop={handleDrop}
	role="button"
	tabindex="0"
>
	<input
		bind:this={fileInput}
		type="file"
		accept=".pdf,.jpg,.jpeg,.png,.tiff,.tif"
		onchange={handleFileSelect}
		class="hidden"
	/>

	{#if state === 'uploading'}
		<div class="upload-content">
			<div class="upload-icon">⏳</div>
			<p class="upload-text">Subiendo archivo...</p>
			<div class="progress-bar">
				<div class="progress-fill" style="width: {progress}%"></div>
			</div>
			<p class="progress-text">{progress}%</p>
		</div>
	{:else if state === 'error'}
		<div class="upload-content">
			<div class="upload-icon">⚠️</div>
			<p class="upload-text error-text">{errorMessage}</p>
			<p class="upload-hint">Suelta el archivo o toca para seleccionar otro</p>
		</div>
	{:else}
		<div class="upload-content">
			<div class="upload-icon">📄</div>
			<p class="upload-text">Arrastra archivos aquí o toca para seleccionar</p>
			<p class="upload-hint">PDF, JPG, PNG, TIFF · Máx. 50MB</p>
		</div>
	{/if}
</div>

<style>
	.upload-zone {
		width: 100%;
		aspect-ratio: 1 / 1;
		min-height: 200px;
		background-color: var(--color-surface-sunken);
		border: 2px dashed var(--color-border);
		border-radius: var(--radius-xl);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition:
			border-color 0.15s ease,
			background-color 0.15s ease;
		user-select: none;
	}

	.upload-zone.dragover {
		border-color: var(--color-accent);
		background-color: var(--color-error-surface);
	}

	.upload-zone.error {
		border-color: var(--color-error);
	}

	.upload-zone.uploading {
		cursor: default;
	}

	.upload-content {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
		padding: 1rem;
		text-align: center;
	}

	.upload-icon {
		font-size: 3rem;
		line-height: 1;
	}

	.upload-text {
		font-size: var(--text-body);
		color: var(--color-text-primary);
		margin: 0;
	}

	.upload-text.error-text {
		color: var(--color-error);
		font-weight: 500;
	}

	.upload-hint {
		font-size: var(--text-body-small);
		color: var(--color-text-secondary);
		margin: 0;
	}

	.progress-bar {
		width: 100%;
		max-width: 200px;
		height: 8px;
		background-color: var(--color-border);
		border-radius: var(--radius-full);
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		background-color: var(--color-accent);
		border-radius: var(--radius-full);
		transition: width 0.1s linear;
	}

	.progress-text {
		font-size: var(--text-body-small);
		color: var(--color-text-secondary);
		margin: 0;
	}

	.hidden {
		display: none;
	}
</style>