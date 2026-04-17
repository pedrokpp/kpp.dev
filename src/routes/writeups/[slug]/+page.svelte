<script lang="ts">
	import { marked } from 'marked';
	import { difficultyColor } from '$lib/writeups';

	let { data } = $props();
	const meta = $derived(data.meta);
	const html = $derived(marked(data.content));
</script>

<svelte:head>
	<title>{meta.name} — write-ups — kp</title>
	<link rel="canonical" href="https://kpp.dev/writeups/{meta.slug}" />
	<meta name="description" content="{meta.platform} · {meta.difficulty} · {meta.os} — {meta.techniques.slice(0, 3).join(', ')}" />
	<meta property="og:title" content="{meta.name} — write-ups — kp" />
	<meta property="og:description" content="{meta.platform} · {meta.difficulty} · {meta.os} — {meta.techniques.slice(0, 3).join(', ')}" />
	<meta property="og:url" content="https://kpp.dev/writeups/{meta.slug}" />
	<meta property="og:type" content="article" />
	<meta property="og:image" content="https://github.com/pedrokpp.png" />
	<meta name="twitter:card" content="summary" />
	<meta name="twitter:title" content="{meta.name} — write-ups — kp" />
	<meta name="twitter:description" content="{meta.platform} · {meta.difficulty} · {meta.os} — {meta.techniques.slice(0, 3).join(', ')}" />
	<meta name="twitter:image" content="https://github.com/pedrokpp.png" />
</svelte:head>

<div class="bg"></div>

<div class="page">
	<nav>
		<a href="/writeups" class="back">
			<svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
				<path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
			</svg>
			write-ups
		</a>
	</nav>

	<header>
		<div class="meta-row">
			<span class="platform">{meta.platform}</span>
			<span class="dot">·</span>
			<span class="difficulty" style="color: {difficultyColor[meta.difficulty]}">{meta.difficulty}</span>
			<span class="dot">·</span>
			<span class="os">{meta.os}</span>
		</div>
		<h1>{meta.name}</h1>
		<div class="techniques">
			{#each meta.techniques as t}
				<span class="tag">{t}</span>
			{/each}
		</div>
	</header>

	<article class="prose">
		{@html html}
	</article>
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
		background: radial-gradient(ellipse at 20% 50%, rgba(139, 92, 246, 0.05) 0%, transparent 60%);
		pointer-events: none;
		z-index: 0;
	}

	.page {
		position: relative;
		z-index: 1;
		max-width: 780px;
		margin: 0 auto;
		padding: 3rem 1.5rem 5rem;
	}

	nav {
		margin-bottom: 2.5rem;
	}

	.back {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		color: #71717a;
		text-decoration: none;
		font-size: 0.875rem;
		transition: color 0.2s;
	}

	.back:hover { color: #a78bfa; }

	header {
		margin-bottom: 2.5rem;
		padding-bottom: 2rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
	}

	.meta-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.8rem;
		margin-bottom: 0.75rem;
	}

	.platform, .os { color: #52525b; text-transform: uppercase; letter-spacing: 0.05em; }
	.dot { color: #3f3f46; }
	.difficulty { font-weight: 600; }

	h1 {
		font-size: 2rem;
		font-weight: 700;
		background: linear-gradient(135deg, #a78bfa, #c4b5fd);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
		margin: 0 0 1rem;
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

	/* prose styles */
	.prose :global(h1) { display: none; }

	.prose :global(h2) {
		font-size: 1.3rem;
		font-weight: 600;
		color: #e4e4e7;
		margin: 2rem 0 0.75rem;
		padding-bottom: 0.4rem;
		border-bottom: 1px solid rgba(139, 92, 246, 0.15);
	}

	.prose :global(h3) {
		font-size: 1.05rem;
		font-weight: 600;
		color: #c4b5fd;
		margin: 1.5rem 0 0.5rem;
	}

	.prose :global(p) {
		color: #a1a1aa;
		line-height: 1.75;
		margin: 0.75rem 0;
	}

	.prose :global(pre) {
		background: rgba(0, 0, 0, 0.4);
		border: 1px solid rgba(139, 92, 246, 0.12);
		border-radius: 10px;
		padding: 1rem 1.25rem;
		overflow-x: auto;
		margin: 1rem 0;
	}

	.prose :global(code) {
		font-family: 'Courier New', 'Fira Code', monospace;
		font-size: 0.85rem;
		color: #c4b5fd;
	}

	.prose :global(pre code) {
		color: #e4e4e7;
	}

	.prose :global(:not(pre) > code) {
		background: rgba(139, 92, 246, 0.12);
		padding: 0.15rem 0.4rem;
		border-radius: 4px;
		font-size: 0.85em;
	}

	.prose :global(table) {
		width: 100%;
		border-collapse: collapse;
		margin: 1rem 0;
		font-size: 0.9rem;
	}

	.prose :global(th) {
		text-align: left;
		padding: 0.5rem 0.75rem;
		color: #71717a;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
	}

	.prose :global(td) {
		padding: 0.5rem 0.75rem;
		color: #a1a1aa;
		border-bottom: 1px solid rgba(255, 255, 255, 0.04);
	}

	.prose :global(td strong) { color: #e4e4e7; }

	.prose :global(a) {
		color: #a78bfa;
		text-decoration: none;
	}

	.prose :global(a:hover) { color: #c4b5fd; text-decoration: underline; }

	.prose :global(ul), .prose :global(ol) {
		color: #a1a1aa;
		padding-left: 1.5rem;
		line-height: 1.75;
		margin: 0.75rem 0;
	}

	.prose :global(li) { margin: 0.25rem 0; }

	.prose :global(strong) { color: #e4e4e7; }

	.prose :global(blockquote) {
		border-left: 3px solid rgba(139, 92, 246, 0.4);
		padding-left: 1rem;
		margin: 1rem 0;
		color: #71717a;
		font-style: italic;
	}
</style>
