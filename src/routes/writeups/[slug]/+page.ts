import { error } from '@sveltejs/kit';
import { writeups } from '$lib/writeups';

const markdowns = import.meta.glob('/src/lib/writeups/hackthebox/*.md', {
	query: '?raw',
	import: 'default'
});

export async function load({ params }) {
	const meta = writeups.find(w => w.slug === params.slug);
	if (!meta) error(404, 'Writeup não encontrado');

	const key = `/src/lib/writeups/hackthebox/${params.slug}.md`;
	const loader = markdowns[key];
	if (!loader) error(404, 'Conteúdo não encontrado');

	const content = await loader() as string;
	return { meta, content };
}
