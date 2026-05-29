<script lang="ts">
	import '../app.css';
	import UserSettingsButton from '$lib/components/UserSettingsButton.svelte';

	let { children } = $props();
</script>

<div class="min-h-screen bg-surface">
	<UserSettingsButton />
	{@render children()}
</div>