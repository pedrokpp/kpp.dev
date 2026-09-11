import type { Writeup } from '$lib/writeups';

const fireflow = {
	slug: 'fireflow',
	name: 'Fireflow',
	platform: 'HackTheBox',
	difficulty: 'Medium',
	os: 'Linux',
	techniques: ['Langflow class body RCE', 'credential disclosure', 'password reuse', 'JWT alg=none', 'k8s nodes/proxy access', 'kubelet exec via GET websocket']
} satisfies Writeup;

export default fireflow;