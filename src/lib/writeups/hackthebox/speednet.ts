import type { Writeup } from '$lib/writeups';

const speednet = {
	slug: 'speednet',
	name: 'SpeedNet',
	platform: 'HackTheBox',
	difficulty: 'Easy',
	os: 'Web',
	techniques: [
		'GraphQL Introspection',
		'IDOR',
		'Password Reset Abuse',
		'2FA Bypass',
		'GraphQL Alias Batching'
	]
} satisfies Writeup;

export default speednet;
