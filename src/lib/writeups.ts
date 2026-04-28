import airtouch from './writeups/hackthebox/airtouch';

export interface Writeup {
	slug: string;
	name: string;
	platform: string;
	difficulty: 'Easy' | 'Medium' | 'Hard' | 'Insane';
	os: string;
	techniques: string[];
}

export const writeups: Writeup[] = [
	airtouch,
	{
		slug: 'lame',
		name: 'Lame',
		platform: 'HackTheBox',
		difficulty: 'Easy',
		os: 'Linux',
		techniques: ['Samba 3.0.20 Exploitation', 'usermap_script RCE']
	},
	{
		slug: 'bounty-hunter',
		name: 'Bounty Hunter',
		platform: 'HackTheBox',
		difficulty: 'Easy',
		os: 'Linux',
		techniques: ['XXE Injection', 'LFI', 'Python eval() Exploitation']
	},
	{
		slug: 'driver',
		name: 'Driver',
		platform: 'HackTheBox',
		difficulty: 'Easy',
		os: 'Windows',
		techniques: ['SCF File Attack', 'Hash Capture', 'PrintNightmare CVE-2021-1675']
	},
	{
		slug: 'editorial',
		name: 'Editorial',
		platform: 'HackTheBox',
		difficulty: 'Easy',
		os: 'Linux',
		techniques: ['SSRF', 'Port Scanning', 'Git History Exploitation', 'CVE-2022-24439']
	},
	{
		slug: 'forge',
		name: 'Forge',
		platform: 'HackTheBox',
		difficulty: 'Medium',
		os: 'Linux',
		techniques: ['SSRF', 'Blacklist Bypass', 'FTP Protocol Exploitation', 'SSH Key Extraction']
	},
	{
		slug: 'permx',
		name: 'PermX',
		platform: 'HackTheBox',
		difficulty: 'Easy',
		os: 'Linux',
		techniques: ['Chamilo LMS', 'CVE-2023-4220', 'Symlink Privilege Escalation']
	},
	{
		slug: 'previse',
		name: 'Previse',
		platform: 'HackTheBox',
		difficulty: 'Easy',
		os: 'Linux',
		techniques: ['HTTP Response Manipulation', 'RCE', 'Hash Cracking', 'PATH Hijacking']
	},
	{
		slug: 'secret',
		name: 'Secret',
		platform: 'HackTheBox',
		difficulty: 'Easy',
		os: 'Linux',
		techniques: ['JWT Token Manipulation', 'Git History', 'RCE', 'CoreDump Analysis']
	}
];

export const difficultyColor: Record<string, string> = {
	Easy: '#22c55e',
	Medium: '#f59e0b',
	Hard: '#ef4444',
	Insane: '#a855f7'
};
