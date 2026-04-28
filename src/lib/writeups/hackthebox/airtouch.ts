import type { Writeup } from '$lib/writeups';

const airtouch = {
	slug: 'airtouch',
	name: 'AirTouch',
	platform: 'HackTheBox',
	difficulty: 'Medium',
	os: 'Linux',
	techniques: ['SNMP enumeration', 'WPA2-PSK traffic decryption', 'cookie tampering', 'unrestricted file upload', 'credential disclosure', 'sudo NOPASSWD']
} satisfies Writeup;

export default airtouch;
