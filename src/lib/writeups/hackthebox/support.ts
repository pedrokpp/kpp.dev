import type { Writeup } from '$lib/writeups';

const support = {
	slug: 'support',
	name: 'Support',
	platform: 'HackTheBox',
	difficulty: 'Easy',
	os: 'Windows',
	techniques: ['SMB null session', 'XOR decryption (.NET binary)', 'LDAP attribute disclosure', 'RBCD + S4U2Proxy', 'WMI execution']
} satisfies Writeup;

export default support;