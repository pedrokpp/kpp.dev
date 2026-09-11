import type { Writeup } from '$lib/writeups';

const nexus = {
	slug: 'nexus',
	name: 'Nexus',
	platform: 'HackTheBox',
	difficulty: 'Easy',
	os: 'Linux',
	techniques: ['vHost enumeration', 'Git history', 'CVE-2026-38526 unrestricted file upload', 'credential disclosure', 'password reuse', 'Gitea template sync path traversal']
} satisfies Writeup;

export default nexus;