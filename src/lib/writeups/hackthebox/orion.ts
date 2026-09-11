import type { Writeup } from '$lib/writeups';

const orion = {
	slug: 'orion',
	name: 'Orion',
	platform: 'HackTheBox',
	difficulty: 'Very Easy',
	os: 'Linux',
	techniques: ['CraftCMS enumeration', 'CSRF token bypass', 'CVE-2025-32432 session poisoning RCE', 'hash cracking (GPU)', 'password reuse', 'CVE-2026-24061 telnetd auth bypass']
} satisfies Writeup;

export default orion;