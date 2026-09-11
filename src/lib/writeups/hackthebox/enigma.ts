import type { Writeup } from '$lib/writeups';

const enigma = {
	slug: 'enigma',
	name: 'Enigma',
	platform: 'HackTheBox',
	difficulty: 'Easy',
	os: 'Linux',
	techniques: ['NFS anonymous export', 'IMAP password reuse', 'OpenSTAManager module upload RCE', 'hash cracking', 'su via pty', 'OliveTin argument injection']
} satisfies Writeup;

export default enigma;