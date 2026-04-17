<script lang="ts">
	import { writeups, difficultyColor } from '$lib/writeups';

	let query = $state('');

	const matches = $derived.by(() => {
		const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
		if (!tokens.length) return null;
		return new Set(
			writeups
				.filter(w => {
					const haystack = [w.name, w.platform, w.os, w.difficulty, ...w.techniques]
						.map(s => s.toLowerCase());
					return tokens.every(token => haystack.some(field => field.includes(token)));
				})
				.map(w => w.slug)
		);
	});

	const matchCount = $derived(matches === null ? writeups.length : matches.size);

	const displayed = $derived.by(() => {
		if (matches === null) return writeups;
		return [
			...writeups.filter(w => matches.has(w.slug)),
			...writeups.filter(w => !matches.has(w.slug)),
		];
	});
</script>

<svelte:head>
	<title>write-ups — kp</title>
	<link rel="canonical" href="https://kpp.dev/writeups" />
	<meta name="description" content="notas de resolução de máquinas e desafios ctf" />
	<meta property="og:title" content="write-ups — kp" />
	<meta property="og:description" content="notas de resolução de máquinas e desafios ctf" />
	<meta property="og:url" content="https://kpp.dev/writeups" />
	<meta property="og:type" content="website" />
	<meta property="og:image" content="https://github.com/pedrokpp.png" />
	<meta name="twitter:card" content="summary" />
	<meta name="twitter:title" content="write-ups — kp" />
	<meta name="twitter:description" content="notas de resolução de máquinas e desafios ctf" />
	<meta name="twitter:image" content="https://github.com/pedrokpp.png" />
</svelte:head>

<div class="bg"></div>

<div class="page">
	<header>
		<a href="/" class="back">
			<svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
				<path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
			</svg>
			pedro
		</a>
		<h1>write-ups</h1>
		<p class="subtitle">notas de resolução de máquinas e desafios ctf</p>
		<div class="search-wrap">
			<svg class="search-icon" width="14" height="14" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
				<path d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
			</svg>
			<input
				class="search"
				type="search"
				placeholder="buscar por nome, tag, dificuldade, OS..."
				bind:value={query}
				autocomplete="off"
				spellcheck="false"
			/>
		</div>
	</header>

	{#if matchCount === 0}
		<p class="empty">nenhum resultado para <em>"{query}"</em></p>
	{/if}

	<div class="grid">
		{#each displayed as w}
			<a
				href="/writeups/{w.slug}"
				class="card"
				class:hidden={matches !== null && !matches.has(w.slug)}
				tabindex={matches !== null && !matches.has(w.slug) ? -1 : 0}
			>
				<div class="card-header">
					<span class="platform">{w.platform}</span>
					<span class="difficulty" style="color: {difficultyColor[w.difficulty]}">{w.difficulty}</span>
				</div>
				<h2>{w.name}</h2>
				<div class="os">
					<svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24">
						<path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-5 11H4v-2h11v2zm5-4H4V9h16v2z"/>
					</svg>
					{w.os}
				</div>
				<div class="techniques">
					{#each w.techniques.slice(0, 3) as t}
						<span class="tag">{t}</span>
					{/each}
					{#if w.techniques.length > 3}
						<span class="tag more">+{w.techniques.length - 3}</span>
					{/if}
				</div>
			</a>
		{/each}
	</div>
</div>

<style>
	:global(body) {
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		background: #0a0a0f;
		color: #e4e4e7;
		margin: 0;
		min-height: 100vh;
	}

	.bg {
		position: fixed;
		inset: 0;
		background: radial-gradient(ellipse at 20% 50%, rgba(139, 92, 246, 0.05) 0%, transparent 60%),
					radial-gradient(ellipse at 80% 20%, rgba(139, 92, 246, 0.04) 0%, transparent 50%);
		pointer-events: none;
		z-index: 0;
	}

	.page {
		position: relative;
		z-index: 1;
		max-width: 900px;
		margin: 0 auto;
		padding: 3rem 1.5rem;
	}

	header {
		margin-bottom: 3rem;
	}

	.back {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		color: #71717a;
		text-decoration: none;
		font-size: 0.875rem;
		transition: color 0.2s;
		margin-bottom: 2rem;
	}

	.back:hover {
		color: #a78bfa;
	}

	h1 {
		font-size: 2.5rem;
		font-weight: 700;
		background: linear-gradient(135deg, #c4b5fd, #a78bfa, #8b5cf6, #7c3aed, #a78bfa, #c4b5fd);
		background-size: 300% auto;
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
		margin: 0 0 0.5rem;
		animation: gradient-cycle 24s linear infinite;
	}

	@keyframes gradient-cycle {
		0%   { background-position: 0% center; }
		100% { background-position: 300% center; }
	}

	.subtitle {
		color: #71717a;
		font-size: 0.9rem;
		margin: 0 0 1.25rem;
		text-transform: lowercase;
	}

	.search-wrap {
		position: relative;
		max-width: 420px;
	}

	.search-icon {
		position: absolute;
		left: 0.75rem;
		top: 50%;
		transform: translateY(-50%);
		color: #52525b;
		pointer-events: none;
	}

	.search {
		width: 100%;
		background: rgba(18, 15, 24, 0.7);
		border: 1px solid rgba(139, 92, 246, 0.15);
		border-radius: 10px;
		padding: 0.55rem 0.9rem 0.55rem 2.25rem;
		font-family: inherit;
		font-size: 0.85rem;
		color: #e4e4e7;
		outline: none;
		transition: border-color 0.2s;
	}

	.search::placeholder {
		color: #3f3f46;
	}

	.search:focus {
		border-color: rgba(139, 92, 246, 0.4);
	}

	.search::-webkit-search-cancel-button {
		-webkit-appearance: none;
	}

	.empty {
		color: #52525b;
		font-size: 0.9rem;
		padding: 2rem 0;
	}

	.empty em {
		color: #71717a;
		font-style: normal;
	}

	.grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 1rem;
	}

	@media (min-width: 600px) {
		.grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	@media (min-width: 1024px) {
		.grid {
			grid-template-columns: repeat(3, 1fr);
		}

		.page {
			max-width: 1100px;
			zoom: 1.15;
		}
	}

	.card {
		display: block;
		background: rgba(18, 15, 24, 0.7);
		border: 1px solid rgba(139, 92, 246, 0.12);
		border-radius: 16px;
		padding: 1.25rem;
		text-decoration: none;
		color: inherit;
		transition: border-color 0.2s, transform 0.2s, background 0.2s;
	}

	.card:hover {
		border-color: rgba(139, 92, 246, 0.35);
		background: rgba(139, 92, 246, 0.05);
		transform: translateY(-2px);
	}

	.card-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.75rem;
	}

	.platform {
		font-size: 0.75rem;
		color: #52525b;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.difficulty {
		font-size: 0.75rem;
		font-weight: 600;
	}

	.card h2 {
		font-size: 1.15rem;
		font-weight: 600;
		color: #e4e4e7;
		margin: 0 0 0.5rem;
	}

	.os {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		font-size: 0.8rem;
		color: #71717a;
		margin-bottom: 0.75rem;
	}

	.techniques {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}

	.tag {
		font-size: 0.7rem;
		padding: 0.2rem 0.5rem;
		border-radius: 6px;
		background: rgba(139, 92, 246, 0.1);
		color: #a78bfa;
		border: 1px solid rgba(139, 92, 246, 0.2);
	}

	.tag.more {
		background: rgba(255, 255, 255, 0.05);
		color: #52525b;
		border-color: rgba(255, 255, 255, 0.08);
	}

	.card.hidden {
		visibility: hidden;
		pointer-events: none;
	}
</style>
