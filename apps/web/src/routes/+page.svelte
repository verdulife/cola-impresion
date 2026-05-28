<script lang="ts">
	import UploadZone from '$lib/components/UploadZone.svelte';

	function handleUpload(file: { id: string; name: string }) {
		console.log('Archivo subido:', file.name);
	}
</script>

<div class="page-container">
	<h1 class="text-h1 text-text-primary">Cola de impresión</h1>
	<UploadZone onupload={handleUpload} />
</div>

<style>
	.page-container {
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
</style>